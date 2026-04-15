import { serperSearch, serperImageSearch } from "../../lib/serper.js";
import type { AgentState, PollDraft, QueryCandidate, ProductPayload } from "../state.js";

export async function curateNode(s: AgentState): Promise<Partial<AgentState>> {
  const drafts: PollDraft[] = [];

  for (const q of s.dynamicQueries) {
    try {
      const draft = await buildDraft(q);
      if (draft) drafts.push(draft);
    } catch (e) {
      console.error(`[curate] 실패: ${q.themeTitle}`, e);
    }
  }

  return { finalJson: drafts };
}

async function buildDraft(q: QueryCandidate): Promise<PollDraft | null> {
  // 상품 정보 검색 (병렬)
  const [resultA, resultB] = await Promise.all([
    serperSearch(`${q.queryA} 공식 스펙 특징`),
    serperSearch(`${q.queryB} 공식 스펙 특징`),
  ]);

  // 이미지 검색 (병렬)
  const [urlA, urlB] = await Promise.all([
    findImage(q.queryA),
    findImage(q.queryB),
  ]);

  const productA = parseProduct(q.queryA, resultA, urlA);
  const productB = parseProduct(q.queryB, resultB, urlB);
  const curatorNote = buildNote(productA, productB, q.category);

  return {
    category: q.category,
    themeTitle: q.themeTitle,
    productA,
    productB,
    curatorNote,
  };
}

/** 검색 결과에서 브랜드/상품명/특징 파싱 */
function parseProduct(query: string, searchResult: string, imageUrl: string): ProductPayload {
  // 쿼리에서 브랜드(첫 단어)와 상품명 분리
  const words = query.split(" ");
  const brand = words[0] ?? query;
  const name = words.slice(1).join(" ") || query;

  // 검색 결과 스니펫에서 특징 문장 3개 추출
  const lines = searchResult
    .split("\n")
    .map((l) => l.replace(/^- [^:]+:\s*/, "").trim())
    .filter((l) => l.length > 15 && l.length < 120 && !l.startsWith("http"))
    .slice(0, 3);

  const features = lines.length >= 3
    ? lines
    : [...lines, ...[`${name} 프리미엄 품질`, "고급 소재 및 장인 정신", "한정 수량 프리미엄 에디션"].slice(lines.length)];

  return { brand, name, features: features.slice(0, 3), imageUrl, videoUrl: "" };
}

/** 카테고리에 맞는 큐레이터 노트 생성 */
function buildNote(a: ProductPayload, b: ProductPayload, category: string): string {
  const templates: Record<string, string> = {
    "럭셔리 시계": `${a.brand}의 정밀함과 ${b.brand}의 혁신, 당신의 손목을 빛낼 선택은?`,
    "프리미엄 자동차": `${a.brand}의 퍼포먼스와 ${b.brand}의 럭셔리, 당신이 원하는 드라이브는?`,
    "하이엔드 스니커즈": `${a.brand}의 스트리트 감성과 ${b.brand}의 명품 무드, 발끝의 선택은?`,
    "프리미엄 가전": `${a.brand}의 기술력과 ${b.brand}의 디자인, 당신의 라이프스타일에 맞는 건?`,
    "럭셔리 주얼리": `${a.brand}의 우아함과 ${b.brand}의 아이코닉함, 평생 함께할 주얼리는?`,
    "프리미엄 오디오": `${a.brand}의 음향 기술과 ${b.brand}의 사운드 철학, 귀를 사로잡는 선택은?`,
    "명품 가방": `${a.brand}의 클래식과 ${b.brand}의 헤리티지, 나를 표현할 백은?`,
  };
  return templates[category] ?? `${a.brand}와 ${b.brand}, 당신의 선택은?`;
}

/** 이미지 URL 탐색 */
async function findImage(query: string): Promise<string> {
  const candidates = await serperImageSearch(query);
  for (const url of candidates) {
    if (await validateImage(url)) return url;
  }
  return "";
}

async function validateImage(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return r.ok && (r.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}
