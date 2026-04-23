import type { AgentState } from "../state.js";

const CURATION_PROMPT =
  "너는 20대 여성의 소비 트렌드와 럭셔리/라이프스타일 시장을 분석하는 " +
  "'TabGet 자율형 큐레이션 에이전트'야. 다음 카테고리별로 현재 가장 화제가 되고 있는 " +
  "중고가(Mid-to-High end) 상품 중, 서로 강력한 라이벌 관계인 1, 2위 상품 대결(VS) " +
  "세트를 구성해줘. 카테고리는 시계, 가전, 핸드폰, 가방, 자동차로하고 가격대는 " +
  "브랜드의 가치가 느껴지는 중가 이상의 프리미엄 라인업으로 타겟 트렌드에 민감하고 " +
  "심미적 가치를 중시하는 소비자";

export async function scoutNode(
  _: Pick<AgentState, "rawTrends" | "dynamicQueries" | "finalJson">
): Promise<Partial<AgentState>> {
  return { rawTrends: CURATION_PROMPT };
}
