import "dotenv/config";
import { generateNode } from "./agent/nodes/generate.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawTrends =
  "너는 20대 여성의 소비 트렌드와 럭셔리/라이프스타일 시장을 분석하는 " +
  "'TabGet 자율형 큐레이션 에이전트'야. 다음 카테고리별로 현재 가장 화제가 되고 있는 " +
  "중고가(Mid-to-High end) 상품 중, 서로 강력한 라이벌 관계인 1, 2위 상품 대결(VS) " +
  "세트를 구성해줘. 카테고리는 시계, 가전, 핸드폰, 가방, 자동차로하고 가격대는 " +
  "브랜드의 가치가 느껴지는 중가 이상의 프리미엄 라인업으로 타겟 트렌드에 민감하고 " +
  "심미적 가치를 중시하는 소비자";

console.log("=== generate 노드 단독 테스트 ===");
console.log(`LLM_PROVIDER: ${process.env.LLM_PROVIDER}`);
console.log(`GEMINI_MODEL: ${process.env.GEMINI_MODEL}`);
console.log(`MOCK_LLM: ${process.env.MOCK_LLM}`);
console.log(`GEMINI_LOG: ${process.env.GEMINI_LOG}`);
console.log("");

const start = Date.now();
const result = await generateNode({ rawTrends, dynamicQueries: [], finalJson: [] });
const elapsed = Date.now() - start;

console.log("\n=== 결과 ===");
console.log(`소요 시간: ${elapsed}ms`);
console.log(`생성된 쿼리 수: ${result.dynamicQueries?.length ?? 0}`);
console.log(JSON.stringify(result.dynamicQueries, null, 2));

try {
  const usage = readFileSync(join(__dirname, "../data/gemini-usage.json"), "utf-8");
  console.log("\n=== gemini-usage.json ===");
  console.log(usage);
} catch {
  console.log("\n(gemini-usage.json 파일 없음)");
}
