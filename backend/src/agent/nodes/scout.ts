import { serperSearch } from "../../lib/serper.js";
import type { AgentState } from "../state.js";

export async function scoutNode(
  _: Pick<AgentState, "rawTrends" | "dynamicQueries" | "finalJson">
): Promise<Partial<AgentState>> {
  // 트렌드 수집 없이 generate 단계에서 직접 상품 선정
  return { rawTrends: "" };
}
