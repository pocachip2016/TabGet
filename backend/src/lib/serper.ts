import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const CACHE_FILE = join(DATA_DIR, "serper-cache.json");
const USAGE_FILE = join(DATA_DIR, "serper-usage.json");
const DAILY_LIMIT = Number(process.env.SERPER_DAILY_LIMIT ?? 10);

interface UsageRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

interface SerperCache {
  [query: string]: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadUsage(): UsageRecord {
  try {
    const parsed = JSON.parse(readFileSync(USAGE_FILE, "utf-8")) as UsageRecord;
    if (parsed.date === today()) return parsed;
  } catch {
    // 파일 없거나 파싱 실패 → 새 날
  }
  return { date: today(), count: 0 };
}

function saveUsage(usage: UsageRecord): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

function loadCache(): SerperCache {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as SerperCache;
  } catch {
    return {};
  }
}

function saveCache(cache: SerperCache): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function callSerperApi(q: string): Promise<string> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q, gl: "kr", hl: "ko" }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { organic?: Array<{ title: string; snippet: string }> };
  const items = (json.organic ?? []).slice(0, 8);
  return items.map((i) => `- ${i.title}: ${i.snippet}`).join("\n");
}

export async function serperSearch(q: string): Promise<string> {
  const useSerper = process.env.USE_SERPER !== "false";
  const cache = loadCache();

  // USE_SERPER=false: 캐시 전용
  if (!useSerper) {
    if (cache[q]) return cache[q];
    throw new Error(
      `USE_SERPER=false이지만 캐시에 없는 쿼리: "${q}"\n` +
        `USE_SERPER=true로 한 번 실행해 캐시를 채우세요.`
    );
  }

  // 일일 한도 초과 → 캐시 폴백
  const usage = loadUsage();
  if (usage.count >= DAILY_LIMIT) {
    if (cache[q]) {
      console.warn(`[serper] 일일 한도(${DAILY_LIMIT}) 초과 → 캐시 사용: "${q}"`);
      return cache[q];
    }
    throw new Error(
      `Serper 일일 한도(${DAILY_LIMIT}) 초과 & 캐시 없음: "${q}"`
    );
  }

  // 실제 API 호출
  const result = await callSerperApi(q);

  // 캐시 저장
  cache[q] = result;
  saveCache(cache);

  // 사용량 증가
  usage.count += 1;
  saveUsage(usage);

  console.info(`[serper] API 호출 (오늘 ${usage.count}/${DAILY_LIMIT}): "${q}"`);
  return result;
}

/** 이미지 검색: 상품명으로 실제 이미지 URL 반환 (캐시 지원) */
export async function serperImageSearch(q: string): Promise<string[]> {
  const cacheKey = `__img__${q}`;
  const cache = loadCache();

  // 캐시 히트
  if (cache[cacheKey]) {
    try { return JSON.parse(cache[cacheKey]) as string[]; } catch { /* invalid cache */ }
  }

  const useSerper = process.env.USE_SERPER !== "false";
  if (!useSerper) return [];

  const usage = loadUsage();
  if (usage.count >= DAILY_LIMIT) return [];

  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q, gl: "kr", hl: "ko" }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as { images?: Array<{ imageUrl?: string }> };
  const urls = (json.images ?? [])
    .map((i) => i.imageUrl ?? "")
    .filter(Boolean)
    .slice(0, 10);

  // 캐시 저장 (이미지 검색도 사용량 차감)
  cache[cacheKey] = JSON.stringify(urls);
  saveCache(cache);
  usage.count += 1;
  saveUsage(usage);

  console.info(`[serper] 이미지 검색 (오늘 ${usage.count}/${DAILY_LIMIT}): "${q}"`);
  return urls;
}

/** 현재 캐시에 저장된 쿼리 목록과 오늘 사용량을 반환 */
export function serperStatus(): { todayCount: number; limit: number; cachedQueries: string[] } {
  const usage = loadUsage();
  const cache = loadCache();
  return {
    todayCount: usage.count,
    limit: DAILY_LIMIT,
    cachedQueries: Object.keys(cache),
  };
}
