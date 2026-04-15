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

app.get("/serper-status", async () => serperStatus());

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
// ─────────────────────────────────────────────────────────────────────────────

app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
