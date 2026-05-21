import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "@prisma/client";
import cron from "node-cron";
import { prisma } from "./db.js";
import { curationAgent } from "./agent/curator.js";
import type { AgentAnnotationState } from "./agent/curator.js";
import type { PollDraft } from "./agent/state.js";
import { serperStatus } from "./lib/serper.js";
import { agentLog } from "./lib/logger.js";
import { AgentCallbackHandler } from "./lib/agentCallbackHandler.js";
import { geminiLimiter } from "./lib/gemini-quota.js";
import { buildMockBatch, saveBatch, publishDue, generateAndPublish, generateBatch } from "./battle/generate.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** 큐레이션 에이전트 실행 + DB 저장 공통 로직 */
async function runCuration(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const runId = `run-${Date.now()}`;
  agentLog("INFO", "agent:invoke:start", { runId });
  const agentStart = Date.now();

  try {
    const result: AgentAnnotationState = await curationAgent.invoke(
      { rawTrends: "", dynamicQueries: [], finalJson: [] },
      { callbacks: [new AgentCallbackHandler()] }
    );

    agentLog("INFO", "agent:invoke:end", {
      runId,
      durationMs: Date.now() - agentStart,
      pollCount: result.finalJson.length,
      rawTrends: result.rawTrends,
      dynamicQueries: result.dynamicQueries,
      finalJson: result.finalJson,
    });

    // 기존 themeTitle과 중복이면 건너뜀
    const existingTitles = new Set(
      (await prisma.poll.findMany({ select: { themeTitle: true } }))
        .map((p) => p.themeTitle)
    );

    let insertOffset = 0;
    const saved = (
      await Promise.all(
        result.finalJson.map(async (d: PollDraft) => {
          if (existingTitles.has(d.themeTitle)) {
            agentLog("INFO", "curation:skip:duplicate", { themeTitle: d.themeTitle });
            return null;
          }
          const poll = await prisma.poll.create({
            data: {
              category: d.category,
              themeTitle: d.themeTitle,
              productA: toInputJson(d.productA),
              productB: toInputJson(d.productB),
              curatorNote: d.curatorNote,
              status: "ACTIVE",
              scheduledAt: new Date(Date.now() + insertOffset++ * 60_000),
            },
          });
          return poll;
        })
      )
    ).filter(Boolean);

    await prisma.trendLog.create({
      data: {
        rawTrends: result.rawTrends,
        queries: toInputJson(result.dynamicQueries),
      },
    });

    return { success: true, data: saved };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    agentLog("ERROR", "agent:invoke:error", {
      runId,
      durationMs: Date.now() - agentStart,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ─── 스케줄러 ───────────────────────────────────────────────────────────────
// CURATION_SCHEDULE: cron 표현식 (기본: 매일 오전 9시 KST = UTC 00:00)
// 예) "0 9 * * *"  → 매일 09:00
//     "0 */6 * * *" → 6시간마다
const schedule = process.env.CURATION_SCHEDULE ?? "0 0 * * *";

cron.schedule(schedule, async () => {
  agentLog("INFO", "scheduler:trigger", { schedule });
  const result = await runCuration();
  if (result.success) {
    agentLog("INFO", "scheduler:done", { schedule });
  } else {
    agentLog("ERROR", "scheduler:failed", { schedule, error: result.error });
  }
}, { timezone: "Asia/Seoul" });

agentLog("INFO", "scheduler:registered", { schedule, timezone: "Asia/Seoul" });

// ─── 배틀 배치 cron (매일 17:00 KST = PT 자정 리셋 1h 후, BATTLE_ENABLED=true 게이트) ────────────
if (process.env.BATTLE_ENABLED === "true") {
  cron.schedule("0 17 * * *", async () => {
    try {
      const activePolls = await prisma.poll.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 10,
      });
      for (const p of activePolls) {
        const count = await generateBatch(p.id, 40);
        agentLog("INFO", "battle:batch:cron", { pollId: p.id, count });
      }
    } catch (e) {
      agentLog("ERROR", "battle:batch:cron:error", { error: e instanceof Error ? e.message : String(e) });
    }
  }, { timezone: "Asia/Seoul" });
  agentLog("INFO", "battle:batch:cron:registered", { schedule: "17:00 KST daily (1h after PT midnight RPD reset)" });
}
// ────────────────────────────────────────────────────────────────────────────

app.post("/run-curation", async (_, reply) => {
  const result = await runCuration();
  if (result.success) return result;
  return reply.status(500).send(result);
});

interface PollQuery {
  visitorId?: string;
}

app.get<{ Querystring: PollQuery }>("/polls", async (req) => {
  const { visitorId } = req.query;

  // 풀 = ARCHIVED가 아닌 전체 poll (최신순)
  const poolPolls = await prisma.poll.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { scheduledAt: "desc" },
    include: { votes: { select: { side: true } } },
  });

  let votedPollIds: string[] = [];
  if (visitorId) {
    const myVotes = await prisma.vote.findMany({
      where: { visitorId },
      select: { pollId: true },
    });
    votedPollIds = myVotes.map((v) => v.pollId);
  }

  // 미투표 먼저, 부족하면 투표한 것으로 채워 항상 최대 5개 반환
  const unvoted = poolPolls.filter((p) => !votedPollIds.includes(p.id));
  const voted   = poolPolls.filter((p) =>  votedPollIds.includes(p.id));
  const selected = [...unvoted, ...voted].slice(0, 5);

  // 배치 메시지 전체 조회 (side별 최대 50개)
  const selectedIds = selected.map(p => p.id);
  const recentMessages = await prisma.message.findMany({
    where: { pollId: { in: selectedIds }, status: "PUBLISHED" },
    orderBy: { publishAt: "asc" },
    select: { id: true, pollId: true, side: true, authorName: true, content: true, personaMode: true, publishAt: true, createdAt: true },
  });

  const msgByPoll = new Map<string, typeof recentMessages>();
  for (const m of recentMessages) {
    if (!msgByPoll.has(m.pollId)) msgByPoll.set(m.pollId, []);
    msgByPoll.get(m.pollId)!.push(m);
  }
  const capMessages = (msgs: typeof recentMessages) => {
    const a = msgs.filter(m => m.side === "A").slice(-50);
    const b = msgs.filter(m => m.side === "B").slice(-50);
    return [...a, ...b];
  };

  const polls = selected.map((p) => ({
    id: p.id,
    category: p.category,
    themeTitle: p.themeTitle,
    productA: p.productA,
    productB: p.productB,
    curatorNote: p.curatorNote,
    status: p.status,
    scheduledAt: p.scheduledAt,
    votesA: p.baseVotesA + p.votes.filter((v) => v.side === "A").length,
    votesB: p.baseVotesB + p.votes.filter((v) => v.side === "B").length,
    messages: capMessages(msgByPoll.get(p.id) ?? []),
  }));

  return { polls, votedPollIds };
});

interface VoteParams {
  id: string;
}

interface VoteBody {
  side: "A" | "B";
  visitorId?: string;
}

app.post<{ Params: VoteParams; Body: VoteBody }>(
  "/polls/:id/vote",
  async (req, reply) => {
    // 00:00~00:59 는 투표 마감 구간
    const h = new Date().getHours();
    if (h === 0) {
      return reply.code(423).send({ error: "voting_closed" });
    }

    try {
      const vote = await prisma.vote.create({
        data: {
          pollId: req.params.id,
          side: req.body.side,
          ...(req.body.visitorId ? { visitorId: req.body.visitorId } : {}),
        },
      });
      return { id: vote.id, side: vote.side, createdAt: vote.createdAt };
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return reply.code(409).send({ error: "already_voted" });
      }
      throw e;
    }
  }
);

// ─── Battle API ──────────────────────────────────────────────────────────────

interface PollParams {
  id: string;
}

interface MessagesQuery {
  since?: string; // ISO timestamp, return messages after this
}

app.get<{ Params: PollParams; Querystring: MessagesQuery }>(
  "/polls/:id/messages",
  async (req, reply) => {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!poll) return reply.code(404).send({ error: "poll_not_found" });

    // Publish any scheduled messages that are now due
    await publishDue(req.params.id);

    const since = req.query.since ? new Date(req.query.since) : undefined;

    const messages = await prisma.message.findMany({
      where: {
        pollId: req.params.id,
        status: "PUBLISHED",
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { publishAt: "asc" },
      select: {
        id: true,
        side: true,
        authorName: true,
        content: true,
        personaMode: true,
        publishAt: true,
        createdAt: true,
      },
    });

    return { messages };
  }
);

app.post<{ Params: PollParams }>(
  "/polls/:id/battle/tick",
  async (req, reply) => {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!poll) return reply.code(404).send({ error: "poll_not_found" });
    const generated = await generateAndPublish(req.params.id);
    return { generated };
  }
);

app.post<{ Params: PollParams }>(
  "/polls/:id/battle/seed",
  async (req, reply) => {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!poll) return reply.code(404).send({ error: "poll_not_found" });

    const batch = buildMockBatch(req.params.id);
    const count = await saveBatch(batch);
    return { seeded: count };
  }
);

// ─────────────────────────────────────────────────────────────────────────────

app.get("/serper-status", async () => serperStatus());

app.get("/gemini-status", async () => geminiLimiter.status());

// ─── Admin API ──────────────────────────────────────────────────────────────

interface AdminPollsQuery {
  page?: string;
  limit?: string;
  status?: string;
  runAt?: string; // ISO timestamp — filter polls within ±60s
}

app.get<{ Querystring: AdminPollsQuery }>("/admin/polls", async (req) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 10)));
  const skip = (page - 1) * limit;
  const statusFilter = req.query.status && req.query.status !== "ALL"
    ? req.query.status
    : undefined;

  // runAt: filter polls created within ±60s of the given timestamp
  let timeFilter: { createdAt: { gte: Date; lte: Date } } | undefined;
  if (req.query.runAt) {
    const center = new Date(req.query.runAt);
    timeFilter = {
      createdAt: {
        gte: new Date(center.getTime() - 60_000),
        lte: new Date(center.getTime() + 60_000),
      },
    };
  }

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(timeFilter ?? {}),
  };

  const [total, rawPolls] = await Promise.all([
    prisma.poll.count({ where }),
    prisma.poll.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { votes: { select: { side: true } } },
    }),
  ]);

  const polls = rawPolls.map((p) => ({
    id: p.id,
    category: p.category,
    themeTitle: p.themeTitle,
    productA: p.productA,
    productB: p.productB,
    curatorNote: p.curatorNote,
    status: p.status,
    scheduledAt: p.scheduledAt,
    createdAt: p.createdAt,
    votesA: p.baseVotesA + p.votes.filter((v) => v.side === "A").length,
    votesB: p.baseVotesB + p.votes.filter((v) => v.side === "B").length,
  }));

  return { polls, total, page, limit, totalPages: Math.ceil(total / limit) };
});

interface AdminPollParams {
  id: string;
}

interface AdminPollStatusBody {
  status: string;
}

app.patch<{ Params: AdminPollParams; Body: AdminPollStatusBody }>(
  "/admin/polls/:id/status",
  async (req, reply) => {
    const valid = ["PENDING", "ACTIVE", "ARCHIVED"];
    if (!valid.includes(req.body.status)) {
      return reply.code(400).send({ error: "invalid status" });
    }
    const updated = await prisma.poll.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      select: { id: true, status: true },
    });
    return updated;
  }
);

app.post("/admin/polls/activate-pending", async () => {
  const result = await prisma.poll.updateMany({
    where: { status: "PENDING" },
    data: { status: "ACTIVE" },
  });
  return { updated: result.count };
});

interface AdminTrendLogsQuery {
  page?: string;
  limit?: string;
}

app.get<{ Querystring: AdminTrendLogsQuery }>("/admin/trend-logs", async (req) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 5)));
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    prisma.trendLog.count(),
    prisma.trendLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, rawTrends: true, queries: true, createdAt: true },
    }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
});

interface SeedAllQuery {
  count?: string;
}

app.post<{ Querystring: SeedAllQuery }>("/admin/battle/seed-all", async (req) => {
  const count = Math.min(100, Math.max(1, Number(req.query.count ?? 40)));

  // poll당 2 RPD 사용 (A+B 각 1회). 남은 quota에 맞게 poll 수 제한
  const { remainingToday } = geminiLimiter.status();
  const maxPolls = Math.max(0, Math.floor(remainingToday / 2));
  if (maxPolls === 0) {
    return { polls: [], total: 0, skipped: "quota_exhausted", remainingToday };
  }

  const activePolls = await prisma.poll.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, themeTitle: true },
    orderBy: { scheduledAt: "desc" },
    take: Math.min(20, maxPolls),
  });
  const results = await Promise.all(
    activePolls.map(async (p) => {
      const generated = await generateBatch(p.id, count);
      return { id: p.id, themeTitle: p.themeTitle, generated };
    })
  );
  return { polls: results, total: results.reduce((s, r) => s + r.generated, 0) };
});
// ─────────────────────────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  agentLog("INFO", "server:shutdown", { signal });
  geminiLimiter.logShutdown();
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
