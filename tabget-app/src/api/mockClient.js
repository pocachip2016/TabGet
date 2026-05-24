import RAW from '../mock/pollData.json';
import { POLL_SEED, LOG_SEED } from '../mock/adminSeed.js';

const APP_START = Date.now();
const VOTES_KEY = 'tabget:mock:votes';
const COUNTS_KEY = 'tabget:mock:counts';
const ADMIN_STATE_KEY = 'tabget:mock:admin:state';
const MAX_EXTRA_POLLS = 20;

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

// Battle tick — mock 모드에선 no-op (자동 cron 없음)
export async function triggerBattleTick() { return { ok: true }; }

// ─── Admin: localStorage state helpers ──────────────────────────────
function readAdminState() {
  try { return JSON.parse(localStorage.getItem(ADMIN_STATE_KEY) || '{}'); }
  catch { return {}; }
}
function writeAdminState(s) {
  localStorage.setItem(ADMIN_STATE_KEY, JSON.stringify(s));
}

// seed + extras 머지, status override 적용
function resolveAdminPolls() {
  const state = readAdminState();
  const overrides = state.statusOverrides ?? {};
  const extras = state.extraPolls ?? [];
  return [...POLL_SEED, ...extras].map(p => ({
    ...p,
    status: overrides[p.id] ?? p.status,
  }));
}

function resolveAdminLogs() {
  const state = readAdminState();
  const extras = state.extraLogs ?? [];
  return [...LOG_SEED, ...extras].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

// 큐레이션 실행 시 생성할 가짜 poll 템플릿 — runCuration 호출마다 round-robin
const CURATION_TEMPLATES = [
  {
    category: '무선이어폰',
    themeTitle: '노이즈캔슬링 무선이어폰: 에어팟 프로 2 vs. 갤럭시 버즈 3 프로',
    productA: {
      name: 'AirPods Pro 2',
      brand: 'Apple',
      imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83?wid=940&hei=1112&fmt=png-alpha',
      gallery: [],
      features: ['적응형 노이즈 캔슬링', '공간 음향', 'H2 칩'],
      videoUrl: '',
    },
    productB: {
      name: 'Galaxy Buds 3 Pro',
      brand: 'Samsung',
      imageUrl: 'https://m.media-amazon.com/images/I/61TJxNXDP4L._AC_SL1500_.jpg',
      gallery: [],
      features: ['Wing-tip 디자인', '24bit 하이파이', '듀얼 드라이버'],
      videoUrl: '',
    },
    curatorNote: 'iPhone 통합이냐 갤럭시 통합이냐 — 당신의 생태계는?',
  },
  {
    category: '정수기',
    themeTitle: '직수형 정수기: 코웨이 마이한뼘 vs. LG 퓨리케어',
    productA: {
      name: '마이한뼘 III',
      brand: '코웨이',
      imageUrl: 'https://m.media-amazon.com/images/I/61Qd-NoT9bL._AC_SL1500_.jpg',
      gallery: [],
      features: ['미네랄 필터', '한 손으로 출수', '주기 알림'],
      videoUrl: '',
    },
    productB: {
      name: '퓨리케어 오브제',
      brand: 'LG',
      imageUrl: 'https://m.media-amazon.com/images/I/51FQbtX2A9L._AC_SL1500_.jpg',
      gallery: [],
      features: ['컬러 인테리어', 'UV 살균', '터치 디스플레이'],
      videoUrl: '',
    },
    curatorNote: '검증된 필터의 코웨이냐, 디자인의 LG냐?',
  },
  {
    category: '안마의자',
    themeTitle: '프리미엄 안마의자: 바디프랜드 팬텀 NEO vs. 휴테크 K2',
    productA: {
      name: '팬텀 NEO',
      brand: '바디프랜드',
      imageUrl: 'https://m.media-amazon.com/images/I/61bSILQHTpL._AC_SL1500_.jpg',
      gallery: [],
      features: ['공기압 마사지 41포인트', 'L자형 트랙', '체형 자동 인식'],
      videoUrl: '',
    },
    productB: {
      name: 'K2',
      brand: '휴테크',
      imageUrl: 'https://m.media-amazon.com/images/I/41C9Ja9DOFL._AC_.jpg',
      gallery: [],
      features: ['스트레칭 프로그램', '4D AI 롤러', '음악 동기화'],
      videoUrl: '',
    },
    curatorNote: '프리미엄 라인의 바디프랜드냐, 합리적 가격의 휴테크냐?',
  },
];

// ─── Admin API ──────────────────────────────────────────────────────
export async function fetchAdminPolls({ page = 1, limit = 10, status = 'ALL', runAt = null } = {}) {
  let polls = resolveAdminPolls();
  if (status !== 'ALL') polls = polls.filter(p => p.status === status);
  if (runAt) {
    // 같은 날짜(KST 기준)의 poll만 필터 — RunChips와 매칭
    const dateKey = runAt.slice(0, 10);
    polls = polls.filter(p => p.createdAt.slice(0, 10) === dateKey);
  }
  polls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = polls.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    polls: polls.slice(start, start + limit),
    total,
    page,
    totalPages,
  };
}

export async function fetchTrendLogs({ page = 1, limit = 20 } = {}) {
  const logs = resolveAdminLogs();
  const total = logs.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    logs: logs.slice(start, start + limit),
    total,
    page,
    totalPages,
  };
}

export async function patchPollStatus(pollId, status) {
  const state = readAdminState();
  writeAdminState({
    ...state,
    statusOverrides: { ...(state.statusOverrides ?? {}), [pollId]: status },
  });
  return { ok: true };
}

export async function activateAllPending() {
  const polls = resolveAdminPolls();
  const state = readAdminState();
  const overrides = { ...(state.statusOverrides ?? {}) };
  let updated = 0;
  for (const p of polls) {
    if (p.status === 'PENDING') {
      overrides[p.id] = 'ACTIVE';
      updated++;
    }
  }
  writeAdminState({ ...state, statusOverrides: overrides });
  return { updated };
}

export async function runCuration() {
  const state = readAdminState();
  const extras = state.extraPolls ?? [];
  const logs = state.extraLogs ?? [];

  // 템플릿을 round-robin으로 선택
  const tpl = CURATION_TEMPLATES[extras.length % CURATION_TEMPLATES.length];
  const now = new Date().toISOString();
  const stamp = Date.now();

  const newPoll = {
    id: `seed-runcuration-${stamp}`,
    status: 'PENDING',
    createdAt: now,
    ...tpl,
    votesA: 0,
    votesB: 0,
  };
  const newLog = {
    id: `run-${stamp}`,
    createdAt: now,
    pollCount: 1,
  };

  writeAdminState({
    ...state,
    extraPolls: [...extras, newPoll].slice(-MAX_EXTRA_POLLS),
    extraLogs: [...logs, newLog].slice(-MAX_EXTRA_POLLS),
  });

  return { data: [newPoll] };
}
