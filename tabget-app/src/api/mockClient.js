import RAW from '../mock/pollData.json';

const APP_START = Date.now();
const VOTES_KEY = 'tabget:mock:votes';
const COUNTS_KEY = 'tabget:mock:counts';

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// incoming pool을 pollId별로 그룹화 + 순환 타이머 설정
const INCOMING_BY_POLL = {};
for (const m of RAW.incomingPool) {
  if (!INCOMING_BY_POLL[m.pollId]) INCOMING_BY_POLL[m.pollId] = [];
  INCOMING_BY_POLL[m.pollId].push(m);
}

const ITEM_INTERVAL_MS = 15_000; // 15초마다 새 메시지 1개

function getVisibleIncoming(pollId, nowMs) {
  const pool = INCOMING_BY_POLL[pollId] ?? [];
  if (!pool.length) return [];
  const elapsed = nowMs - APP_START;
  const cycleMs = pool.length * ITEM_INTERVAL_MS;
  const cycleN = Math.floor(elapsed / cycleMs);
  const cycleElapsed = elapsed % cycleMs;
  const count = Math.min(Math.floor(cycleElapsed / ITEM_INTERVAL_MS), pool.length);
  return pool.slice(0, count).map((m, i) => ({
    ...m,
    id: `${m.id}-c${cycleN}`,
    publishAt: new Date(APP_START + cycleN * cycleMs + (i + 1) * ITEM_INTERVAL_MS).toISOString(),
  }));
}

function getVotes() { return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}'); }
function getCounts() { return JSON.parse(localStorage.getItem(COUNTS_KEY) || '{}'); }
function saveCounts(c) { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)); }

export async function fetchPolls(visitorId) {
  const votes = getVotes();
  const counts = getCounts();
  const now = Date.now();

  const polls = RAW.polls.map(p => {
    const base = RAW.voteBase[p.id] ?? { a: 500, b: 500 };
    if (!counts[p.id]) counts[p.id] = { a: base.a, b: base.b };
    // 소폭 증가로 실시간 느낌
    counts[p.id].a += Math.floor(Math.random() * 2);
    counts[p.id].b += Math.floor(Math.random() * 2);

    const baseMessages = RAW.messages.filter(m => m.pollId === p.id);
    const incoming = getVisibleIncoming(p.id, now);

    return {
      ...p,
      votesA: counts[p.id].a,
      votesB: counts[p.id].b,
      messages: [...baseMessages, ...incoming],
    };
  });

  saveCounts(counts);
  return { polls, votedPollIds: Object.keys(votes) };
}

export async function submitVote(pollId, side, visitorId) {
  const votes = getVotes();
  if (votes[pollId]) {
    throw new ApiError('already_voted', { status: 409, code: 'already_voted' });
  }
  votes[pollId] = side;
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));

  const counts = getCounts();
  if (counts[pollId]) {
    counts[pollId][side === 'A' ? 'a' : 'b'] += 1;
    saveCounts(counts);
  }
  return { success: true };
}

export async function fetchMessages(pollId, since) {
  const now = Date.now();
  const baseMessages = RAW.messages.filter(m => m.pollId === pollId);
  const incoming = getVisibleIncoming(pollId, now);
  const all = [...baseMessages, ...incoming].sort(
    (a, b) => new Date(a.publishAt) - new Date(b.publishAt)
  );
  if (!since) return all;
  return all.filter(m => new Date(m.publishAt) > new Date(since));
}

// AdminPage 및 기타 — mock 모드에서는 no-op
export async function triggerBattleTick() { return { ok: true }; }
export async function fetchAdminPolls() { return { polls: [], total: 0, page: 1 }; }
export async function activateAllPending() { return { count: 0 }; }
export async function patchPollStatus() { return { ok: true }; }
export async function fetchTrendLogs() { return { logs: [] }; }
export async function runCuration() { return { ok: true }; }
