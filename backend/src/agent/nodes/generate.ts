import { HumanMessage } from "@langchain/core/messages";
import type { AgentState, QueryCandidate } from "../state.js";
import { createLLM, rateLimitedInvoke } from "../../lib/llm.js";

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

  // 프리미엄 핸드폰
  { category: "프리미엄 핸드폰", themeTitle: "플래그십 스마트폰 대결: 아이폰 16 프로 vs 갤럭시 S25 울트라", queryA: "Apple iPhone 16 Pro Max", queryB: "Samsung Galaxy S25 Ultra" },
  { category: "프리미엄 핸드폰", themeTitle: "폴더블 대결: 갤럭시 Z 플립6 vs 모토로라 레이저 플러스", queryA: "Samsung Galaxy Z Flip6", queryB: "Motorola Razr Plus 2024" },
];

function pickFive(pool: QueryCandidate[]): QueryCandidate[] {
  const byCategory: Record<string, QueryCandidate[]> = {};
  for (const item of pool) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  const picked: QueryCandidate[] = [];
  const categories = Object.keys(byCategory);

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

const CATEGORIES = [
  "럭셔리 시계", "프리미엄 자동차", "하이엔드 스니커즈", "프리미엄 가전",
  "럭셔리 주얼리", "프리미엄 오디오", "명품 가방", "프리미엄 핸드폰",
];

const GENERATE_PROMPT = `당신은 프리미엄 상품 대결 큐레이터입니다.
아래 트렌드 데이터를 참고하여 프리미엄 상품 대결 주제 5개를 JSON 배열로 생성하세요.

규칙:
- 카테고리는 다음 중에서 선택: ${CATEGORIES.join(", ")}
- 각 대결은 서로 다른 카테고리
- queryA, queryB는 영어 검색 쿼리 (브랜드명 + 상품명)
- themeTitle은 한국어

응답 형식 (JSON 배열만, 다른 텍스트 없이):
[
  {
    "category": "카테고리명",
    "themeTitle": "한국어 대결 제목",
    "queryA": "Brand ProductA",
    "queryB": "Brand ProductB"
  }
]`;

function extractJsonArray(text: string): QueryCandidate[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("LLM 응답에서 JSON 배열을 찾을 수 없습니다");
  return JSON.parse(match[0]) as QueryCandidate[];
}

export async function generateNode(s: AgentState): Promise<Partial<AgentState>> {
  if (process.env.MOCK_LLM === "true") {
    return { dynamicQueries: pickFive(HIGH_END_POOL) };
  }

  try {
    const llm = createLLM(0.8);
    const prompt = s.rawTrends
      ? `${GENERATE_PROMPT}\n\n트렌드 데이터:\n${s.rawTrends}`
      : `${GENERATE_PROMPT}\n\n(트렌드 데이터 없음 — 최신 프리미엄 상품 트렌드를 기반으로 생성하세요)`;

    const result = await rateLimitedInvoke(llm, [new HumanMessage(prompt)]);
    const queries = extractJsonArray(String(result.content));

    if (queries.length < 1) throw new Error("LLM이 빈 배열을 반환했습니다");
    return { dynamicQueries: queries.slice(0, 5) };
  } catch (e) {
    console.error("[generate] LLM 호출 실패, 폴백 사용:", e);
    return { dynamicQueries: pickFive(HIGH_END_POOL) };
  }
}
