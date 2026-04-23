import { HumanMessage } from "@langchain/core/messages";
import { serperSearch, serperImageSearch } from "../../lib/serper.js";
import { createLLM, rateLimitedInvoke } from "../../lib/llm.js";
import type { AgentState, PollDraft, QueryCandidate, ProductPayload } from "../state.js";

export async function curateNode(s: AgentState): Promise<Partial<AgentState>> {
  const drafts: PollDraft[] = [];

  for (const q of s.dynamicQueries) {
    try {
      const draft = await buildDraft(q);
      if (draft) drafts.push(draft);
    } catch (e) {
      console.error(`[curate] 실패: ${q.themeTitle}`, e);
    }
  }

  return { finalJson: drafts };
}

const NORMALIZE_PROMPT = `당신은 상품 정보 정규화 전문가입니다.
아래 검색 결과에서 상품 정보를 추출하세요.

검색 쿼리: {query}
검색 결과:
{searchResult}

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "brand": "브랜드명 (영문)",
  "name": "상품명 (영문)",
  "features": ["특징1 (한국어, 20자 이내)", "특징2", "특징3"]
}`;

async function normalizeWithLLM(
  query: string,
  searchResult: string,
): Promise<{ brand: string; name: string; features: string[] } | null> {
  try {
    const llm = createLLM(0.3);
    const prompt = NORMALIZE_PROMPT
      .replace("{query}", query)
      .replace("{searchResult}", searchResult.slice(0, 1500));
    const result = await rateLimitedInvoke(llm, [new HumanMessage(prompt)]);
    const text = String(result.content);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as { brand: string; name: string; features: string[] };
  } catch (e) {
    console.error("[curate] LLM 정규화 실패:", e);
    return null;
  }
}

async function buildDraft(q: QueryCandidate): Promise<PollDraft | null> {
  const [resultA, resultB] = await Promise.all([
    serperSearch(`${q.queryA} 공식 스펙 특징`),
    serperSearch(`${q.queryB} 공식 스펙 특징`),
  ]);

  const [urlsA, urlsB] = await Promise.all([
    findImages(q.queryA),
    findImages(q.queryB),
  ]);

  let productA: ProductPayload;
  let productB: ProductPayload;

  if (process.env.MOCK_LLM !== "true" && process.env.LLM_PROVIDER === "gemini") {
    const [normA, normB] = await Promise.all([
      normalizeWithLLM(q.queryA, resultA),
      normalizeWithLLM(q.queryB, resultB),
    ]);
    productA = normA
      ? { ...normA, features: normA.features.slice(0, 3), imageUrl: urlsA[0] ?? "", gallery: urlsA.slice(1), videoUrl: "" }
      : parseProduct(q.queryA, resultA, urlsA[0] ?? "", urlsA.slice(1));
    productB = normB
      ? { ...normB, features: normB.features.slice(0, 3), imageUrl: urlsB[0] ?? "", gallery: urlsB.slice(1), videoUrl: "" }
      : parseProduct(q.queryB, resultB, urlsB[0] ?? "", urlsB.slice(1));
  } else {
    productA = parseProduct(q.queryA, resultA, urlsA[0] ?? "", urlsA.slice(1));
    productB = parseProduct(q.queryB, resultB, urlsB[0] ?? "", urlsB.slice(1));
  }

  const curatorNote = buildNote(productA, productB, q.category);

  return {
    category: q.category,
    themeTitle: q.themeTitle,
    productA,
    productB,
    curatorNote,
  };
}

/** 검색 결과에서 브랜드/상품명/특징 파싱 */
function parseProduct(query: string, searchResult: string, imageUrl: string, gallery: string[] = []): ProductPayload {
  // 쿼리에서 브랜드(첫 단어)와 상품명 분리
  const words = query.split(" ");
  const brand = words[0] ?? query;
  const name = words.slice(1).join(" ") || query;

  // 검색 결과 스니펫에서 특징 문장 3개 추출
  const lines = searchResult
    .split("\n")
    .map((l) => l.replace(/^- [^:]+:\s*/, "").trim())
    .filter((l) => l.length > 15 && l.length < 120 && !l.startsWith("http"))
    .slice(0, 3);

  const features = lines.length >= 3
    ? lines
    : [...lines, ...[`${name} 프리미엄 품질`, "고급 소재 및 장인 정신", "한정 수량 프리미엄 에디션"].slice(lines.length)];

  return { brand, name, features: features.slice(0, 3), imageUrl, gallery, videoUrl: "" };
}

/** 카테고리에 맞는 큐레이터 노트 생성 */
function buildNote(a: ProductPayload, b: ProductPayload, category: string): string {
  const templates: Record<string, string> = {
    "럭셔리 시계": `${a.brand}의 정밀함과 ${b.brand}의 혁신, 당신의 손목을 빛낼 선택은?`,
    "프리미엄 자동차": `${a.brand}의 퍼포먼스와 ${b.brand}의 럭셔리, 당신이 원하는 드라이브는?`,
    "하이엔드 스니커즈": `${a.brand}의 스트리트 감성과 ${b.brand}의 명품 무드, 발끝의 선택은?`,
    "프리미엄 가전": `${a.brand}의 기술력과 ${b.brand}의 디자인, 당신의 라이프스타일에 맞는 건?`,
    "럭셔리 주얼리": `${a.brand}의 우아함과 ${b.brand}의 아이코닉함, 평생 함께할 주얼리는?`,
    "프리미엄 오디오": `${a.brand}의 음향 기술과 ${b.brand}의 사운드 철학, 귀를 사로잡는 선택은?`,
    "명품 가방": `${a.brand}의 클래식과 ${b.brand}의 헤리티지, 나를 표현할 백은?`,
    "프리미엄 핸드폰": `${a.brand}의 생태계와 ${b.brand}의 혁신, 내 손 안의 선택은?`,
  };
  return templates[category] ?? `${a.brand}와 ${b.brand}, 당신의 선택은?`;
}

/** 이미지 URL 목록 탐색 — URL 베이스 dedup + 호스트 분산 (동일 호스트 최대 3개) */
async function findImages(query: string, max = 5): Promise<string[]> {
  const candidates = await serperImageSearch(query);
  const seenBase = new Set<string>();
  const hostCount = new Map<string, number>();
  const result: string[] = [];

  for (const url of candidates) {
    if (result.length >= max) break;

    let base: string;
    let host: string;
    try {
      const u = new URL(url);
      base = u.origin + u.pathname;
      host = u.hostname;
    } catch {
      base = url;
      host = url;
    }

    if (seenBase.has(base)) continue;
    if ((hostCount.get(host) ?? 0) >= 3) continue;

    if (await validateImage(url)) {
      seenBase.add(base);
      hostCount.set(host, (hostCount.get(host) ?? 0) + 1);
      result.push(url);
    }
  }

  return result;
}

async function validateImage(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return r.ok && (r.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}
