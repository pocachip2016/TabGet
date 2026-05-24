import { HumanMessage } from "@langchain/core/messages";
import { prisma } from '../db.js';
import { createLLM, rateLimitedInvoke } from '../lib/llm.js';
import { agentLog } from '../lib/logger.js';
import { geminiLimiter } from '../lib/gemini-quota.js';
import { pickBot, getBotsForSide, type PersonaMode } from './bots.js';

export interface SeedBatch {
  pollId: string;
  messages: SeedMessage[];
}

export interface SeedMessage {
  side: 'A' | 'B';
  authorName: string;
  content: string;
  personaMode: PersonaMode;
  publishAt: Date;
}

// Build mock seed batch (60 messages, 1 min apart across 1h)
export function buildMockBatch(pollId: string): SeedBatch {
  const messages: SeedMessage[] = [];
  const now = Date.now();
  const INTERVAL_MS = (60 * 60 * 1000) / 60;

  for (let i = 0; i < 60; i++) {
    const side = (i % 2 === 0 ? 'A' : 'B') as 'A' | 'B';
    const bot = pickBot(side);
    messages.push({
      side,
      authorName: bot.authorName,
      content: `[mock] ${bot.persona} 메시지 #${i + 1}`,
      personaMode: bot.persona,
      publishAt: new Date(now + i * INTERVAL_MS),
    });
  }

  return { pollId, messages };
}

export async function saveBatch(batch: SeedBatch): Promise<number> {
  const data = batch.messages.map(m => ({
    pollId: batch.pollId,
    side: m.side,
    authorName: m.authorName,
    content: m.content,
    personaMode: m.personaMode,
    status: 'SCHEDULED',
    publishAt: m.publishAt,
  }));

  const result = await prisma.message.createMany({ data });

  await prisma.poll.update({
    where: { id: batch.pollId },
    data: { lastBatchAt: new Date() },
  });

  return result.count;
}

// Publish messages whose publishAt <= now
export async function publishDue(pollId: string): Promise<number> {
  const result = await prisma.message.updateMany({
    where: { pollId, status: 'SCHEDULED', publishAt: { lte: new Date() } },
    data: { status: 'PUBLISHED' },
  });
  return result.count;
}

// ─── LLM 배치 생성 ──────────────────────────────────────────────────────────

const PERSONA_GUIDE: Record<PersonaMode, string> = {
  COMPETE: '상대 상품과 비교하며 자기 편 상품의 우월한 스펙이나 실적을 강조. 경쟁적·자신감 있는 어조.',
  CHECK:   '실사용 관점에서 장단점을 냉정하게 따짐. 중립적이지만 결국 자기 편을 지지.',
  COVET:   '갖고 싶다는 감성·욕망 중심. "이거 진짜 갖고싶다" 류의 짧고 감탄하는 어조.',
};

function buildPrompt(
  productName: string,
  opponentName: string,
  side: 'A' | 'B',
  authorName: string,
  persona: PersonaMode,
  reviewSnippets: string[],
): string {
  const snippetSection = reviewSnippets.length > 0
    ? `\n참고 후기 (필요하면 활용, 그대로 복붙 금지):\n${reviewSnippets.slice(0, 3).map(s => `- ${s}`).join('\n')}`
    : '';

  return `당신은 ${authorName}입니다. 상품 배틀 투표 앱의 채팅 봇으로, ${productName}을(를) 응원합니다.

상대 상품: ${opponentName}
페르소나: ${PERSONA_GUIDE[persona]}${snippetSection}

규칙:
- 한국어로 1~2문장 (50자 이내)
- 자연스러운 인터넷 말투 (반말/이모지 허용, 과도한 이모지 금지)
- 상품명을 직접 언급해도 되고 "이쪽" "이거" 등 대명사도 가능
- 반드시 JSON만 반환: {"content": "메시지"}

JSON만 출력 (설명 없이):`;
}

async function generateOneMessage(
  productName: string,
  opponentName: string,
  side: 'A' | 'B',
  authorName: string,
  persona: PersonaMode,
  reviewSnippets: string[],
): Promise<string | null> {
  const prompt = buildPrompt(productName, opponentName, side, authorName, persona, reviewSnippets);

  // 1회 시도 (temperature 0.9), 실패 시 1.0으로 재시도
  for (const temp of [0.9, 1.0]) {
    try {
      const llm = createLLM(temp);
      const result = await rateLimitedInvoke(llm, [new HumanMessage(prompt)]);
      const text = String(result.content);
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]) as { content?: string };
      if (typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
        return parsed.content.trim();
      }
    } catch {
      if (temp === 1.0) return null;
    }
  }
  return null;
}

// Per-poll hourly cap tracker (in-memory, sufficient for single-process)
// 1시간 간격 cron → 최대 1회/시간/poll. 캡 2로 중복 방지.
const hourlyCount = new Map<string, { hour: number; count: number }>();

const HOURLY_CAP = 8;

function checkAndUpdateRateLimit(pollId: string): boolean {
  const currentHour = new Date().getHours();

  // 00시 스킵
  if (currentHour === 0) return false;

  // 시간당 10개 하드캡
  const hc = hourlyCount.get(pollId);
  if (hc && hc.hour === currentHour && hc.count >= HOURLY_CAP) return false;

  if (!hc || hc.hour !== currentHour) {
    hourlyCount.set(pollId, { hour: currentHour, count: 1 });
  } else {
    hc.count++;
  }

  return true;
}

interface PollProduct {
  name?: string;
  brand?: string;
}

// Generate one LLM message and save it as PUBLISHED for the given poll
export async function generateAndPublish(pollId: string, forceSide?: 'A' | 'B', bypassCap = false): Promise<boolean> {
  if (!bypassCap && !checkAndUpdateRateLimit(pollId)) return false;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { status: true, productA: true, productB: true },
  });

  if (!poll || poll.status === 'ARCHIVED') return false;

  // Use forced side or pick randomly
  const side = forceSide ?? (Math.random() < 0.5 ? 'A' : 'B') as 'A' | 'B';
  const bot = pickBot(side);

  const pA = poll.productA as PollProduct;
  const pB = poll.productB as PollProduct;
  const myProduct = side === 'A'
    ? `${pA.brand ?? ''} ${pA.name ?? ''}`.trim()
    : `${pB.brand ?? ''} ${pB.name ?? ''}`.trim();
  const opponent = side === 'A'
    ? `${pB.brand ?? ''} ${pB.name ?? ''}`.trim()
    : `${pA.brand ?? ''} ${pA.name ?? ''}`.trim();

  const content = await generateOneMessage(myProduct, opponent, side, bot.authorName, bot.persona, []);

  if (!content) {
    agentLog('WARN', 'battle:generate:fail', { pollId, side, bot: bot.id });
    return false;
  }

  await prisma.message.create({
    data: {
      pollId,
      side,
      authorName: bot.authorName,
      content,
      personaMode: bot.persona,
      status: 'PUBLISHED',
      publishAt: new Date(),
    },
  });

  agentLog('INFO', 'battle:generate:ok', { pollId, side, bot: bot.id, persona: bot.persona });
  return true;
}

// ─── Batch 사전 생성 ──────────────────────────────────────────────────────────

interface BatchItem {
  side: 'A' | 'B';
  authorName: string;
  content: string;
  personaMode: PersonaMode;
}

async function generateBatchForSide(
  myProduct: string,
  opponent: string,
  side: 'A' | 'B',
  count: number,
): Promise<BatchItem[]> {
  const bots = getBotsForSide(side);
  const botList = bots.map(b => `- ${b.authorName} (${b.persona})`).join('\n');
  const perBot = Math.ceil(count / bots.length);

  const prompt = `당신은 상품 배틀 채팅 봇 운영자입니다. ${myProduct}을(를) 응원하는 채팅 메시지 ${count}개를 생성하세요.

상대 상품: ${opponent}

봇 목록:
${botList}

페르소나 가이드:
- COMPETE: 상대와 비교하며 자기 상품 우월함 강조 (경쟁적, 자신감)
- CHECK: 실사용 관점에서 장단점 냉정 분석 (중립적이지만 결국 자기 편)
- COVET: 갖고싶다는 감성/욕망 ("진짜 갖고싶다" 류 짧은 감탄)

규칙:
- 한국어 1~2문장, 50자 이내, 자연스러운 인터넷 말투 (반말/이모지 허용, 과도한 이모지 금지)
- 봇마다 최대 ${perBot}개씩 분배하여 다양하게
- 페르소나도 각 봇의 페르소나에 맞게
- JSON array만 반환 (설명 없이)

출력 형식:
[{"authorName":"봇이름","content":"메시지","personaMode":"COMPETE"},...]

JSON array만 출력:`;

  for (const temp of [0.9, 1.0]) {
    try {
      const llm = createLLM(temp);
      const result = await rateLimitedInvoke(llm, [new HumanMessage(prompt)]);
      const text = String(result.content);
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) continue;
      const parsed = JSON.parse(match[0]) as Array<{ authorName?: string; content?: string; personaMode?: string }>;
      const valid: BatchItem[] = parsed
        .filter(p => typeof p.content === 'string' && p.content.trim().length > 0)
        .filter(p => p.personaMode === 'COMPETE' || p.personaMode === 'CHECK' || p.personaMode === 'COVET')
        .map(p => ({
          side,
          authorName: typeof p.authorName === 'string' && p.authorName.trim() ? p.authorName.trim() : bots[0].authorName,
          content: p.content!.trim(),
          personaMode: p.personaMode as PersonaMode,
        }));
      if (valid.length > 0) return valid;
    } catch {
      if (temp === 1.0) agentLog('WARN', 'battle:batch:fail', { side, myProduct });
    }
  }
  return [];
}

export async function generateBatch(pollId: string, count = 40): Promise<number> {
  // 각 side당 LLM 1회 + 재시도 가능성 고려 → poll당 최소 2 RPD 필요
  const { remainingToday } = geminiLimiter.status();
  if (remainingToday < 2) {
    agentLog('WARN', 'battle:batch:quota-skip', { pollId, remainingToday });
    return 0;
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { status: true, productA: true, productB: true },
  });
  if (!poll || poll.status === 'ARCHIVED') return 0;

  const pA = poll.productA as PollProduct;
  const pB = poll.productB as PollProduct;
  const productA = `${pA.brand ?? ''} ${pA.name ?? ''}`.trim();
  const productB = `${pB.brand ?? ''} ${pB.name ?? ''}`.trim();

  const half = Math.floor(count / 2);
  const results = await Promise.allSettled([
    generateBatchForSide(productA, productB, 'A', half),
    generateBatchForSide(productB, productA, 'B', half),
  ]);
  const aItems = results[0].status === 'fulfilled' ? results[0].value : [];
  const bItems = results[1].status === 'fulfilled' ? results[1].value : [];

  const allItems = [...aItems, ...bItems];
  if (allItems.length === 0) return 0;

  const result = await prisma.message.createMany({
    data: allItems.map(m => ({
      pollId,
      side: m.side,
      authorName: m.authorName,
      content: m.content,
      personaMode: m.personaMode,
      status: 'PUBLISHED',
      publishAt: new Date(),
    })),
  });

  agentLog('INFO', 'battle:batch:ok', { pollId, count: result.count });
  return result.count;
}

export async function topUpBattle(
  pollId: string,
  threshold = 10,
  perSide = 10,
): Promise<{ aAdded: number; bAdded: number }> {
  const counts = await prisma.message.groupBy({
    by: ['side'],
    where: { pollId, status: { in: ['PUBLISHED', 'SCHEDULED'] } },
    _count: true,
  });
  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.side] = row._count;

  const aNeeded = (countMap['A'] ?? 0) < threshold;
  const bNeeded = (countMap['B'] ?? 0) < threshold;

  if (!aNeeded && !bNeeded) {
    agentLog('INFO', 'battle:topup:skip', { pollId, aCount: countMap['A'] ?? 0, bCount: countMap['B'] ?? 0 });
    return { aAdded: 0, bAdded: 0 };
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { status: true, productA: true, productB: true },
  });
  if (!poll || poll.status === 'ARCHIVED') return { aAdded: 0, bAdded: 0 };

  const pA = poll.productA as PollProduct;
  const pB = poll.productB as PollProduct;
  const productA = `${pA.brand ?? ''} ${pA.name ?? ''}`.trim();
  const productB = `${pB.brand ?? ''} ${pB.name ?? ''}`.trim();

  let aAdded = 0;
  let bAdded = 0;

  if (aNeeded) {
    if (geminiLimiter.status().remainingToday < 2) {
      agentLog('WARN', 'battle:topup:quota-skip', { pollId, side: 'A', remainingToday: geminiLimiter.status().remainingToday });
      return { aAdded, bAdded };
    }
    const items = await generateBatchForSide(productA, productB, 'A', perSide);
    if (items.length > 0) {
      const res = await prisma.message.createMany({
        data: items.map(m => ({
          pollId, side: m.side, authorName: m.authorName,
          content: m.content, personaMode: m.personaMode,
          status: 'PUBLISHED', publishAt: new Date(),
        })),
      });
      aAdded = res.count;
    }
  }

  if (bNeeded) {
    if (geminiLimiter.status().remainingToday < 2) {
      agentLog('WARN', 'battle:topup:quota-skip', { pollId, side: 'B', remainingToday: geminiLimiter.status().remainingToday });
      return { aAdded, bAdded };
    }
    const items = await generateBatchForSide(productB, productA, 'B', perSide);
    if (items.length > 0) {
      const res = await prisma.message.createMany({
        data: items.map(m => ({
          pollId, side: m.side, authorName: m.authorName,
          content: m.content, personaMode: m.personaMode,
          status: 'PUBLISHED', publishAt: new Date(),
        })),
      });
      bAdded = res.count;
    }
  }

  agentLog('INFO', 'battle:topup:ok', { pollId, aAdded, bAdded });
  return { aAdded, bAdded };
}
