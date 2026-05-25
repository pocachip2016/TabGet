// Admin page mock seed data — used by mockClient.js admin functions.
// Layout: 5 ACTIVE (reuses user-facing polls) + 3 PENDING + 5 ARCHIVED + 6 trend logs.
// All createdAt are computed relative to "now" so the demo always looks fresh.

import pollData from './pollData.json';

function isoDaysAgo(days, hour = 8) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

// Reuse the 5 user-facing polls as ACTIVE entries (same IDs → admin and main view stay consistent).
const ACTIVE_POLLS = pollData.polls.map((p, i) => ({
  ...p,
  status: 'ACTIVE',
  // 3 polls from today's run, 2 from yesterday's
  createdAt: isoDaysAgo(i < 3 ? 0 : 1),
  votesA: [12450, 9800, 7600, 11200, 8300][i] ?? 8000,
  votesB: [11820, 10300, 8900, 9700, 7400][i] ?? 7500,
}));

// PENDING — produced by today's run but not yet ACTIVE.
const PENDING_POLLS = [
  {
    id: 'seed-pending-laptop',
    status: 'PENDING',
    createdAt: isoDaysAgo(0, 9),
    category: '프리미엄 노트북',
    themeTitle: '가벼움의 끝판왕: 맥북 에어 M3 vs. LG 그램 17',
    productA: {
      name: 'MacBook Air M3',
      brand: 'Apple',
      imageUrl: '/TabGet/img/unsplash-1517336714731.jpg',
      gallery: ['/TabGet/img/unsplash-1517336714731.jpg'],
      features: ['M3 칩, 8/10코어 GPU', '18시간 배터리', '액티브 쿨링 없는 무소음 디자인'],
      videoUrl: '',
    },
    productB: {
      name: 'LG gram 17',
      brand: 'LG',
      imageUrl: '/TabGet/img/unsplash-1496181133206.jpg',
      gallery: ['/TabGet/img/unsplash-1496181133206.jpg'],
      features: ['17인치 16:10 디스플레이', '1350g 초경량', 'Intel Core Ultra 7'],
      videoUrl: '',
    },
    curatorNote: 'Apple 생태계 통합 vs 17인치 대화면 — 휴대성과 작업 공간의 균형은?',
    votesA: 0,
    votesB: 0,
  },
  {
    id: 'seed-pending-console',
    status: 'PENDING',
    createdAt: isoDaysAgo(0, 9),
    category: '게임 콘솔',
    themeTitle: '휴대용 게이밍의 정점: 닌텐도 스위치 OLED vs. 스팀덱 OLED',
    productA: {
      name: 'Switch OLED',
      brand: 'Nintendo',
      imageUrl: '/TabGet/img/unsplash-1550745165.jpg',
      gallery: [],
      features: ['7인치 OLED 디스플레이', '독점 IP (젤다, 마리오)', '도크 모드 지원'],
      videoUrl: '',
    },
    productB: {
      name: 'Steam Deck OLED',
      brand: 'Valve',
      imageUrl: '/TabGet/img/unsplash-1493711662062.jpg',
      gallery: [],
      features: ['7.4인치 HDR OLED', '전체 Steam 라이브러리 플레이', '90Hz 가변 주사율'],
      videoUrl: '',
    },
    curatorNote: '닌텐도 독점작이냐, PC 게임 풀 라이브러리냐 — 당신의 휴대용 게이밍은?',
    votesA: 0,
    votesB: 0,
  },
  {
    id: 'seed-pending-shoes',
    status: 'PENDING',
    createdAt: isoDaysAgo(0, 9),
    category: '프리미엄 운동화',
    themeTitle: '러닝화의 양대 산맥: 나이키 에어줌 페가수스 41 vs. 아디다스 울트라부스트 라이트',
    productA: {
      name: 'Air Zoom Pegasus 41',
      brand: 'Nike',
      imageUrl: '/TabGet/img/unsplash-1542291026.jpg',
      gallery: ['/TabGet/img/unsplash-1542291026.jpg'],
      features: ['ReactX 폼 미드솔', 'Zoom Air 유닛 듀얼 탑재', '일상 러닝 데일리화'],
      videoUrl: '',
    },
    productB: {
      name: 'Ultraboost Light',
      brand: 'adidas',
      imageUrl: '/TabGet/img/unsplash-1491553895911.jpg',
      gallery: ['/TabGet/img/unsplash-1608231387042.jpg'],
      features: ['Light Boost 폼 (10% 가벼움)', 'Primeknit+ 갑피', '컨티넨탈 러버 아웃솔'],
      videoUrl: '',
    },
    curatorNote: '반응성 좋은 Zoom Air냐, 부드러운 Boost 쿠셔닝이냐 — 당신의 러닝 스타일은?',
    votesA: 0,
    votesB: 0,
  },
];

// ARCHIVED — 지난 회차들 (3~7일 전)
const ARCHIVED_POLLS = [
  {
    id: 'seed-archived-keyboard',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(6),
    category: '기계식 키보드',
    themeTitle: '생산성의 키보드: 로지텍 MX Keys S vs. 키크론 K2',
    productA: {
      name: 'MX Keys S',
      brand: 'Logitech',
      imageUrl: '/TabGet/img/unsplash-1541140532154.jpg',
      gallery: [],
      features: ['멀티 디바이스 3개', '백라이트 자동 조절', 'Smart Actions 매크로'],
      videoUrl: '',
    },
    productB: {
      name: 'K2 v2',
      brand: 'Keychron',
      imageUrl: '/TabGet/img/unsplash-1587829741301.jpg',
      gallery: [],
      features: ['75% 컴팩트 레이아웃', '핫스왑 가능', 'Mac/Win 키캡 모두 포함'],
      videoUrl: '',
    },
    curatorNote: '저소음 정숙함의 로지텍이냐, 기계식 타건감의 키크론이냐?',
    votesA: 5600,
    votesB: 6900,
  },
];

export const POLL_SEED = [...ACTIVE_POLLS, ...PENDING_POLLS, ...ARCHIVED_POLLS];

// TrendLogs — 큐레이션 에이전트 실행 기록. 최신부터 정렬.
export const LOG_SEED = [
  { id: 'run-2026-05-24', createdAt: isoDaysAgo(0, 8), pollCount: 8 },
  { id: 'run-2026-05-23', createdAt: isoDaysAgo(1, 8), pollCount: 2 },
  { id: 'run-2026-05-21', createdAt: isoDaysAgo(3, 8), pollCount: 1 },
];
