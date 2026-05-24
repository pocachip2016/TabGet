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
      imageUrl: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mba13-midnight-select-202402?wid=940&hei=1112&fmt=png-alpha',
      gallery: [],
      features: ['M3 칩, 8/10코어 GPU', '18시간 배터리', '액티브 쿨링 없는 무소음 디자인'],
      videoUrl: '',
    },
    productB: {
      name: 'LG gram 17',
      brand: 'LG',
      imageUrl: 'https://www.lg.com/content/dam/lge/kr/personal/computer/laptop/2024/gram-pro/17z90sp-g/desktop/17z90sp-g-acel-desktop-01.jpg',
      gallery: [],
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
      imageUrl: 'https://m.media-amazon.com/images/I/61-PblYntsL._AC_SL1500_.jpg',
      gallery: [],
      features: ['7인치 OLED 디스플레이', '독점 IP (젤다, 마리오)', '도크 모드 지원'],
      videoUrl: '',
    },
    productB: {
      name: 'Steam Deck OLED',
      brand: 'Valve',
      imageUrl: 'https://m.media-amazon.com/images/I/61MtNNoG9rL._AC_SL1500_.jpg',
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
      imageUrl: 'https://static.nike.com/a/images/t_PDP_1280_v1/f_auto,q_auto:eco/8a8e2efe-0a8c-4d6f-aab3-c12b29e0b988/AIR+ZOOM+PEGASUS+41.png',
      gallery: [],
      features: ['ReactX 폼 미드솔', 'Zoom Air 유닛 듀얼 탑재', '일상 러닝 데일리화'],
      videoUrl: '',
    },
    productB: {
      name: 'Ultraboost Light',
      brand: 'adidas',
      imageUrl: 'https://assets.adidas.com/images/w_600,f_auto,q_auto/d3d5b7e4f1b34123ad04afcd00ff5e16_9366/Ultraboost_Light_Shoes_White_GY9351_01_standard.jpg',
      gallery: [],
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
    id: 'seed-archived-vacuum',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(3),
    category: '프리미엄 가전',
    themeTitle: '무선 청소기의 정점: 다이슨 V15 디텍트 vs. 삼성 비스포크 제트 AI',
    productA: {
      name: 'V15 Detect',
      brand: 'Dyson',
      imageUrl: 'https://m.media-amazon.com/images/I/61UDcL+aZ-L._AC_SL1500_.jpg',
      gallery: [],
      features: ['레이저 먼지 감지', '60분 사용 시간', '5단계 헤파 필터'],
      videoUrl: '',
    },
    productB: {
      name: '비스포크 제트 AI',
      brand: 'Samsung',
      imageUrl: 'https://m.media-amazon.com/images/I/41M1WKvbwAL._AC_.jpg',
      gallery: [],
      features: ['AI 청정 모드', '210W 흡입력', '청정스테이션 자동 먼지 배출'],
      videoUrl: '',
    },
    curatorNote: '레이저 감지의 다이슨이냐, AI 자동 청정의 삼성이냐 — 당신의 청소 루틴은?',
    votesA: 18420,
    votesB: 16780,
  },
  {
    id: 'seed-archived-camera',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(4),
    category: '미러리스 카메라',
    themeTitle: '풀프레임 미러리스의 정상: 소니 α7 IV vs. 캐논 EOS R6 Mark II',
    productA: {
      name: 'α7 IV',
      brand: 'Sony',
      imageUrl: 'https://m.media-amazon.com/images/I/81WMmJsCsbL._AC_SL1500_.jpg',
      gallery: [],
      features: ['33MP 풀프레임', '4K 60p 영상', '듀얼 SD/CFexpress'],
      videoUrl: '',
    },
    productB: {
      name: 'EOS R6 Mark II',
      brand: 'Canon',
      imageUrl: 'https://m.media-amazon.com/images/I/71eOd0d-eqL._AC_SL1500_.jpg',
      gallery: [],
      features: ['24MP 듀얼 픽셀 AF', '40fps 연사', '6K 오버샘플 4K'],
      videoUrl: '',
    },
    curatorNote: '고해상도의 소니냐, 빠른 AF의 캐논이냐 — 당신의 촬영 스타일은?',
    votesA: 9800,
    votesB: 11200,
  },
  {
    id: 'seed-archived-coffee',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(5),
    category: '캡슐 커피머신',
    themeTitle: '홈카페의 양대 산맥: 네스프레소 버츄오 vs. 돌체구스토 지니오 S',
    productA: {
      name: 'Vertuo Plus',
      brand: 'Nespresso',
      imageUrl: 'https://m.media-amazon.com/images/I/61iKVI57WyL._AC_SL1500_.jpg',
      gallery: [],
      features: ['바코드 인식 자동 추출', '5가지 컵 사이즈', '크레마 풍부한 에스프레소'],
      videoUrl: '',
    },
    productB: {
      name: 'Genio S Plus',
      brand: 'Dolce Gusto',
      imageUrl: 'https://m.media-amazon.com/images/I/61BdmkfvFkL._AC_SL1500_.jpg',
      gallery: [],
      features: ['뜨거운/차가운 음료 모두', '30가지 음료 캡슐', '컴팩트 디자인'],
      videoUrl: '',
    },
    curatorNote: '정통 에스프레소냐, 다양한 음료 라인업이냐 — 당신의 홈카페 취향은?',
    votesA: 7400,
    votesB: 8200,
  },
  {
    id: 'seed-archived-keyboard',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(6),
    category: '기계식 키보드',
    themeTitle: '생산성의 키보드: 로지텍 MX Keys S vs. 키크론 K2',
    productA: {
      name: 'MX Keys S',
      brand: 'Logitech',
      imageUrl: 'https://m.media-amazon.com/images/I/61g+rZTOvUL._AC_SL1500_.jpg',
      gallery: [],
      features: ['멀티 디바이스 3개', '백라이트 자동 조절', 'Smart Actions 매크로'],
      videoUrl: '',
    },
    productB: {
      name: 'K2 v2',
      brand: 'Keychron',
      imageUrl: 'https://m.media-amazon.com/images/I/71d-rs+jBPL._AC_SL1500_.jpg',
      gallery: [],
      features: ['75% 컴팩트 레이아웃', '핫스왑 가능', 'Mac/Win 키캡 모두 포함'],
      videoUrl: '',
    },
    curatorNote: '저소음 정숙함의 로지텍이냐, 기계식 타건감의 키크론이냐?',
    votesA: 5600,
    votesB: 6900,
  },
  {
    id: 'seed-archived-monitor',
    status: 'ARCHIVED',
    createdAt: isoDaysAgo(7),
    category: '게이밍 모니터',
    themeTitle: '게이밍 모니터의 정점: 삼성 오디세이 G7 vs. LG 울트라기어 27GR95QE',
    productA: {
      name: '오디세이 G7',
      brand: 'Samsung',
      imageUrl: 'https://m.media-amazon.com/images/I/71Ml58HK0pL._AC_SL1500_.jpg',
      gallery: [],
      features: ['32인치 1000R 커브드', 'QHD 240Hz', 'QLED + HDR600'],
      videoUrl: '',
    },
    productB: {
      name: '울트라기어 27GR95QE',
      brand: 'LG',
      imageUrl: 'https://m.media-amazon.com/images/I/71xQ6dgCnML._AC_SL1500_.jpg',
      gallery: [],
      features: ['27인치 OLED', 'QHD 240Hz', '0.03ms 응답속도'],
      videoUrl: '',
    },
    curatorNote: '커브드 몰입의 오디세이냐, OLED 색감의 울트라기어냐?',
    votesA: 10300,
    votesB: 12800,
  },
];

export const POLL_SEED = [...ACTIVE_POLLS, ...PENDING_POLLS, ...ARCHIVED_POLLS];

// TrendLogs — 큐레이션 에이전트 실행 기록. 최신부터 정렬.
export const LOG_SEED = [
  { id: 'run-2026-05-24', createdAt: isoDaysAgo(0, 8), pollCount: 8 },
  { id: 'run-2026-05-23', createdAt: isoDaysAgo(1, 8), pollCount: 2 },
  { id: 'run-2026-05-21', createdAt: isoDaysAgo(3, 8), pollCount: 1 },
  { id: 'run-2026-05-20', createdAt: isoDaysAgo(4, 8), pollCount: 1 },
  { id: 'run-2026-05-19', createdAt: isoDaysAgo(5, 8), pollCount: 1 },
  { id: 'run-2026-05-18', createdAt: isoDaysAgo(6, 8), pollCount: 1 },
];
