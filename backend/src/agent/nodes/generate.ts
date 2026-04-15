import type { AgentState, QueryCandidate } from "../state.js";

// 하이엔드 상품 풀 (매 실행마다 5쌍 랜덤 선택)
const HIGH_END_POOL: QueryCandidate[] = [
  // 럭셔리 시계
  { category: "럭셔리 시계", themeTitle: "다이버 워치 대결: 롤렉스 서브마리너 vs 오메가 씨마스터", queryA: "Rolex Submariner watch", queryB: "Omega Seamaster Diver 300M watch" },
  { category: "럭셔리 시계", themeTitle: "파일럿 워치 대결: IWC 빅 파일럿 vs 브라이틀링 나비타이머", queryA: "IWC Big Pilot watch", queryB: "Breitling Navitimer watch" },
  { category: "럭셔리 시계", themeTitle: "드레스 워치 대결: 파텍필립 칼라트라바 vs 바쉐론 콘스탄틴 파트리모니", queryA: "Patek Philippe Calatrava watch", queryB: "Vacheron Constantin Patrimony watch" },

  // 프리미엄 자동차
  { category: "프리미엄 자동차", themeTitle: "럭셔리 SUV 대결: 포르쉐 카이엔 vs BMW X5", queryA: "Porsche Cayenne 2025", queryB: "BMW X5 2025" },
  { category: "프리미엄 자동차", themeTitle: "전기 럭셔리 세단 대결: 테슬라 모델S vs 메르세데스 EQS", queryA: "Tesla Model S 2025", queryB: "Mercedes EQS 2025" },
  { category: "프리미엄 자동차", themeTitle: "스포츠카 대결: 포르쉐 911 vs 페라리 로마", queryA: "Porsche 911 Carrera", queryB: "Ferrari Roma" },

  // 하이엔드 스니커즈
  { category: "하이엔드 스니커즈", themeTitle: "럭셔리 스니커즈 대결: 발렌시아가 트리플S vs 구찌 라이튼", queryA: "Balenciaga Triple S sneakers", queryB: "Gucci Rhyton sneakers" },
  { category: "하이엔드 스니커즈", themeTitle: "콜라보 스니커즈 대결: 나이키 x 오프화이트 vs 아디다스 이지 350", queryA: "Nike Off-White collaboration sneakers", queryB: "Adidas Yeezy Boost 350" },
  { category: "하이엔드 스니커즈", themeTitle: "명품 스니커즈 대결: 프라다 클라우드버스트 vs 루이비통 아콰포레스트", queryA: "Prada Cloudbust Thunder sneakers", queryB: "Louis Vuitton Trainer sneakers" },

  // 프리미엄 가전
  { category: "프리미엄 가전", themeTitle: "무선 청소기 대결: 다이슨 V15 vs 삼성 비스포크 제트", queryA: "Dyson V15 Detect vacuum", queryB: "Samsung Bespoke Jet vacuum" },
  { category: "프리미엄 가전", themeTitle: "프리미엄 헤드폰 대결: 소니 WH-1000XM5 vs 뱅앤올룹슨 H95", queryA: "Sony WH-1000XM5 headphones", queryB: "Bang Olufsen Beophones H95 headphones" },
  { category: "프리미엄 가전", themeTitle: "에스프레소 머신 대결: 드롱기 라 스페쥴리스타 vs 필립스 LatteGo", queryA: "De'Longhi La Specialista espresso machine", queryB: "Philips LatteGo espresso machine" },

  // 럭셔리 주얼리
  { category: "럭셔리 주얼리", themeTitle: "시그니처 팔찌 대결: 까르띠에 러브 vs 불가리 비제로원", queryA: "Cartier Love bracelet gold", queryB: "Bulgari B.zero1 bracelet gold" },
  { category: "럭셔리 주얼리", themeTitle: "다이아몬드 목걸이 대결: 티파니 솔레스트 vs 반클리프 알함브라", queryA: "Tiffany Soleste diamond necklace", queryB: "Van Cleef Arpels Alhambra necklace" },

  // 프리미엄 오디오
  { category: "프리미엄 오디오", themeTitle: "무선 이어폰 대결: 애플 에어팟 프로2 vs 젠하이저 모멘텀 4", queryA: "Apple AirPods Pro 2nd generation", queryB: "Sennheiser Momentum 4 wireless" },

  // 명품 가방
  { category: "명품 가방", themeTitle: "클래식 핸드백 대결: 샤넬 클래식 플랩 vs 루이비통 스피디", queryA: "Chanel Classic Flap bag", queryB: "Louis Vuitton Speedy bag" },
  { category: "명품 가방", themeTitle: "토트백 대결: 에르메스 버킨 vs 구찌 오피디아", queryA: "Hermes Birkin bag", queryB: "Gucci Ophidia tote bag" },
];

function pickFive(pool: QueryCandidate[]): QueryCandidate[] {
  // 카테고리별 1개씩, 최대 5개
  const byCategory: Record<string, QueryCandidate[]> = {};
  for (const item of pool) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  const picked: QueryCandidate[] = [];
  const categories = Object.keys(byCategory);

  // 카테고리 순서 섞기
  for (let i = categories.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [categories[i], categories[j]] = [categories[j], categories[i]];
  }

  for (const cat of categories) {
    if (picked.length >= 5) break;
    const items = byCategory[cat];
    const item = items[Math.floor(Math.random() * items.length)];
    picked.push(item);
  }

  return picked;
}

export async function generateNode(s: AgentState): Promise<Partial<AgentState>> {
  if (process.env.MOCK_LLM === "true") {
    return { dynamicQueries: pickFive(HIGH_END_POOL) };
  }
  return { dynamicQueries: pickFive(HIGH_END_POOL) };
}
