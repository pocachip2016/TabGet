# Gemini API 쿼터 관리 에이전트 구현 계획

## Context

현재 `backend/src/lib/llm.ts`에 `ChatGoogleGenerativeAI` 인스턴스를 생성하는 `createLLM()`이 있지만:

1. **어떤 에이전트 노드에서도 LLM을 호출하지 않음** — `generate.ts`는 하드코딩 풀에서 5개 선택, `curate.ts`는 Serper만 사용
2. **쿼터 관리 없음** — RPM/RPD/TPM 추적·제한 로직 부재
3. **모델 하드코딩** — `gemini-2.0-flash` 고정, env 변수 미지원

목표: (A) Gemini 무료 티어 쿼터를 안전하게 지키는 rate limiter 구현 (B) 에이전트 노드에서 실제 LLM 호출 연결

---

## 1. Gemini 무료 티어 쿼터 (2026년 기준, 2025.12.07 감축 이후)

| 모델 | RPM | RPD | TPM |
|------|-----|-----|-----|
| `gemini-2.5-pro` | 5 | 100 | 250,000 |
| `gemini-2.5-flash` | 10 | 250 | 250,000 |
| `gemini-2.5-flash-lite` | 15 | 1,000 | 250,000 |
| `gemini-2.0-flash` | 5 | 200 | 250,000 |

- RPD는 **태평양 시간(PT) 자정**에 리셋
- 쿼터는 **프로젝트 단위** (API 키 단위 아님)
- 표기된 한도는 보장값이 아닌 상한값

> 출처: [Google AI Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits), [Gemini API Free Tier Rate Limits (2026)](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)

---

## 2. 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 모델/쿼터 설정 | `GEMINI_MODEL` env → 코드 내장 테이블에서 RPM/RPD/TPM 자동 로드 | 오타 방지, 한도 변경 시 코드 한 곳만 수정 |
| 초과 시 동작 | **Block (대기 후 재시도)** | RPM/TPM → 다음 분 슬롯까지 sleep. RPD 소진 → 에러 throw (당일 복구 불가) |
| 카운터 영속성 | **JSON 파일** (`backend/data/gemini-usage.json`) | Docker volume 보존, Prisma 스키마 변경 불필요 |
| TPM 추적 | 응답 `usageMetadata.totalTokenCount` 사후 기록 | **90% 도달 시 선제 block** → 초과 호출 원천 차단 |

---

## 3. 핵심 모듈: `backend/src/lib/gemini-quota.ts` (신규)

### 3.1 구조

```
├── QUOTA_TABLE: Record<model, {rpm, rpd, tpm}>   // 내장 한도 테이블
├── class GeminiRateLimiter
│   ├── state: UsageState
│   ├── acquire(): Promise<void>        // 호출 전 게이트 (block or throw)
│   ├── record(tokenCount): void        // 호출 후 사용량 기록
│   ├── status(): QuotaStatus           // 현재 사용량 조회 (API용)
│   └── load() / save()                 // JSON 영속화
└── export const geminiLimiter           // 싱글톤
```

### 3.2 QUOTA_TABLE (내장 한도 테이블)

```ts
const QUOTA_TABLE: Record<string, { rpm: number; rpd: number; tpm: number }> = {
  "gemini-2.5-pro":        { rpm: 5,  rpd: 100,   tpm: 250_000 },
  "gemini-2.5-flash":      { rpm: 10, rpd: 250,   tpm: 250_000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1_000, tpm: 250_000 },
  "gemini-2.0-flash":      { rpm: 5,  rpd: 200,   tpm: 250_000 },
};
```

알 수 없는 모델 → 가장 보수적인 한도(`rpm:5, rpd:100, tpm:250,000`) 적용 + 경고 로그

### 3.3 UsageState (JSON 파일 스키마)

```ts
interface MinuteEntry {
  ts: number;      // epoch ms
  count: number;   // 요청 수 (항상 1)
  tokens: number;  // 실제 사용 토큰 (record() 후 갱신)
}

interface UsageState {
  date: string;              // "2026-04-16" (PT 기준 날짜)
  rpdCount: number;          // 오늘 총 요청 수
  minuteWindow: MinuteEntry[];  // 슬라이딩 60초 윈도우
}
```

파일 경로: `backend/data/gemini-usage.json`

```json
{
  "date": "2026-04-16",
  "rpdCount": 12,
  "minuteWindow": [
    { "ts": 1713254400000, "count": 1, "tokens": 1523 },
    { "ts": 1713254412000, "count": 1, "tokens": 2841 }
  ]
}
```

### 3.4 acquire() — 호출 전 게이트

```
1. load() — JSON에서 state 로드
2. 날짜 체크: state.date ≠ 오늘(PT) → rpdCount=0, minuteWindow=[] (일일 리셋)
3. minuteWindow 정리: 60초 이상 된 엔트리 제거 (슬라이딩 윈도우)

4. RPD 체크:
   if rpdCount >= limits.rpd
     → throw QuotaExhaustedError("RPD 한도 소진, PT 자정에 리셋")

5. RPM 체크:
   recentCount = minuteWindow.length
   if recentCount >= limits.rpm
     → oldestTs = minuteWindow[0].ts
     → waitMs = 60_000 - (now - oldestTs)
     → sleep(waitMs) → acquire() 재귀 (리트라이)

6. TPM 체크 (90% 선제 차단):
   recentTokens = sum(minuteWindow.map(e => e.tokens))
   if recentTokens >= limits.tpm * 0.9
     → oldestTs = minuteWindow[0].ts
     → waitMs = 60_000 - (now - oldestTs)
     → sleep(waitMs) → acquire() 재귀

7. 통과:
   rpdCount++
   minuteWindow.push({ ts: now, count: 1, tokens: 0 })
   save()
```

### 3.5 record(tokenCount) — 호출 후 기록

```
1. load()
2. minuteWindow 마지막 엔트리의 tokens = tokenCount
3. save()
```

### 3.6 status() — 현재 사용량 조회

```ts
interface QuotaStatus {
  model: string;
  limits: { rpm: number; rpd: number; tpm: number };
  usage: {
    rpdUsed: number;
    rpmCurrent: number;    // 최근 60초 요청 수
    tpmCurrent: number;    // 최근 60초 토큰 수
  };
  remainingToday: number;  // rpd - rpdUsed
  tpmUtilization: number;  // tpmCurrent / tpm (0~1)
}
```

---

## 4. LLM 래퍼: `backend/src/lib/llm.ts` 수정

### 4.1 변경점

1. **`GEMINI_MODEL` env 변수 지원**
   ```ts
   case "gemini": {
     const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
     const base = new ChatGoogleGenerativeAI({ model, apiKey, temperature });
     // → rate limiter 래퍼로 감싸서 반환
   }
   ```

2. **`rateLimitedInvoke()` export**
   ```ts
   export async function rateLimitedInvoke(
     llm: BaseChatModel,
     messages: BaseMessage[]
   ): Promise<AIMessageChunk> {
     await geminiLimiter.acquire();
     const result = await llm.invoke(messages);
     const tokens = result.usage_metadata?.total_tokens
       ?? estimateTokens(result.content);
     geminiLimiter.record(tokens);
     return result;
   }
   ```

3. **토큰 추정 fallback** (usageMetadata가 없을 때)
   ```ts
   function estimateTokens(content: string): number {
     return Math.ceil(content.length / 4);  // 보수적 추정
   }
   ```

### 4.2 에이전트 노드에서의 사용

```ts
// generate.ts (예시)
import { createLLM, rateLimitedInvoke } from "../../lib/llm.js";
import { HumanMessage } from "@langchain/core/messages";

const llm = createLLM(0.8);

export async function generateNode(s: AgentState) {
  if (process.env.MOCK_LLM === "true") {
    return { dynamicQueries: pickFive(HIGH_END_POOL) };
  }

  const result = await rateLimitedInvoke(llm, [
    new HumanMessage(`트렌드:\n${s.rawTrends}\n\n대결 주제 5개를 JSON으로...`)
  ]);
  return { dynamicQueries: JSON.parse(extractJson(result.content)) };
}
```

---

## 5. 환경 변수: `backend/.env.example` 수정

```env
# Gemini 모델 선택 (무료 티어 모델별 한도가 다름)
# gemini-2.5-flash    → 10 RPM / 250 RPD / 250K TPM
# gemini-2.5-pro      →  5 RPM / 100 RPD / 250K TPM
# gemini-2.5-flash-lite → 15 RPM / 1,000 RPD / 250K TPM
# gemini-2.0-flash    →  5 RPM / 200 RPD / 250K TPM
GEMINI_MODEL=gemini-2.5-flash

# Gemini 쿼터 로그 (data/gemini.log)
# true: 로그 기록 + 콘솔 출력 | false: 비활성화 (운영 시 끄기)
GEMINI_LOG=true
```

---

## 6. 모니터링 API: `GET /gemini-status`

`backend/src/index.ts`에 추가 (기존 `GET /serper-status`와 동일 패턴):

```ts
app.get("/gemini-status", async () => geminiLimiter.status());
```

응답 예시:
```json
{
  "model": "gemini-2.5-flash",
  "limits": { "rpm": 10, "rpd": 250, "tpm": 250000 },
  "usage": { "rpdUsed": 18, "rpmCurrent": 2, "tpmCurrent": 4200 },
  "remainingToday": 232,
  "tpmUtilization": 0.017
}
```

---

## 7. 에이전트 노드 LLM 호출 분석

### 7.1 현재 상태 (LLM 미사용)

| 노드 | 현재 동작 | LLM 사용 |
|------|-----------|----------|
| `scout.ts` | 빈 문자열 반환 | 없음 |
| `generate.ts` | 하드코딩 풀에서 랜덤 5개 선택 | 없음 (`MOCK_LLM` 분기와 무관하게 동일) |
| `curate.ts` | Serper 결과를 규칙 기반 파싱 | 없음 |

### 7.2 LLM 연결 후 (MOCK_LLM=false)

| 노드 | 변경 후 동작 | Gemini 호출 횟수 |
|------|-------------|-----------------|
| `scout.ts` | Serper 트렌드 수집 (LLM 불필요) | 0회 |
| `generate.ts` | 트렌드 → LLM으로 대결 쿼리 5개 생성 | **1회** |
| `curate.ts` | 각 대결 후보별 LLM으로 상품 정보 정규화 | **최대 5회** |

### 7.3 쿼터 소비 시뮬레이션

**한 번의 큐레이션 실행 = ~6회 Gemini 호출**

| 모델 | RPD | 일일 큐레이션 가능 횟수 | 스케줄 예시 |
|------|-----|----------------------|------------|
| `gemini-2.5-flash` | 250 | ~41회 | 매 30분 (충분) |
| `gemini-2.5-pro` | 100 | ~16회 | 매 90분 |
| `gemini-2.5-flash-lite` | 1,000 | ~166회 | 매 10분 |
| `gemini-2.0-flash` | 200 | ~33회 | 매 45분 |

현재 `CURATION_SCHEDULE=0 9 * * *` (하루 1회) 기준 → **어떤 모델이든 충분**

---

## 8. 수정 대상 파일 요약

| 파일 | 변경 | 핵심 내용 |
|------|------|----------|
| `backend/src/lib/gemini-quota.ts` | **신규** | QUOTA_TABLE, GeminiRateLimiter, JSON 영속화, `geminiLog()` 로거 |
| `backend/src/lib/llm.ts` | 수정 | GEMINI_MODEL env, rateLimitedInvoke() 래퍼 + API call/response 로그 |
| `backend/.env.example` | 수정 | GEMINI_MODEL, GEMINI_LOG 항목 추가 |
| `backend/src/index.ts` | 수정 | `GET /gemini-status` 엔드포인트, graceful shutdown 로그 |
| `backend/src/agent/nodes/generate.ts` | 수정 | MOCK_LLM=false 시 LLM 호출 연결 |
| `backend/src/agent/nodes/curate.ts` | 수정 | LLM 기반 상품 정보 정규화 |
| `backend/data/gemini.log` | **자동생성** | Gemini 쿼터 운영 로그 (JSON Lines, GEMINI_LOG=true 시) |

---

## 9. 검증 방법

### 9.1 단위 테스트

- `GeminiRateLimiter`에 RPM=2 설정 → 3번 연속 `acquire()` → 3번째가 ~60초 대기하는지 확인
- JSON의 `date`를 어제로 변경 → `acquire()` → `rpdCount`가 0으로 리셋되는지 확인
- `minuteWindow`에 TPM×0.9 토큰 기록 → `acquire()` → block 확인

### 9.2 통합 테스트

```bash
# .env 설정
LLM_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=AIza...
MOCK_LLM=false

# 큐레이션 실행
curl -X POST http://localhost:3000/run-curation

# 확인 사항:
# 1. 성공 응답 { success: true, data: [...] }
# 2. backend/data/gemini-usage.json 갱신됨
# 3. rpdCount가 6 증가 (generate 1 + curate 5)
```

### 9.3 모니터링

```bash
curl http://localhost:3000/gemini-status
# → remainingToday, tpmUtilization 값 확인
```

### 9.4 RPD 소진 시나리오

```bash
# gemini-usage.json의 rpdCount를 limits.rpd로 수동 변경
curl -X POST http://localhost:3000/run-curation
# → 500 + "RPD 한도 소진" 에러 확인
```

---

## 10. Gemini 전용 로그: `gemini.log`

기존 `agentLog()` → `agent.log` 패턴을 그대로 따르되, Gemini 쿼터 관련 이벤트만 별도 파일(`backend/data/gemini.log`)에 기록.

### 10.1 환경 변수

```env
# Gemini 로그 활성화 (개발 완료 후 false로 끄기)
# true: gemini.log 파일 기록 + 콘솔 출력
# false: 로그 완전 비활성화 (성능 오버헤드 제로)
GEMINI_LOG=true
```

### 10.2 로그 함수: `geminiLog()`

`backend/src/lib/gemini-quota.ts` 내부에 구현 (별도 파일 불필요).
기존 `agentLog()`와 동일한 JSON Lines 형식.

```ts
import { appendFileSync, mkdirSync } from "node:fs";

const GEMINI_LOG_FILE = join(DATA_DIR, "gemini.log");

function geminiLog(level: "INFO" | "WARN" | "ERROR", event: string, payload?: unknown): void {
  if (process.env.GEMINI_LOG !== "true") return;  // 환경변수로 on/off

  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(payload !== undefined ? { payload } : {}),
  };
  const line = JSON.stringify(entry);

  try {
    mkdirSync(dirname(GEMINI_LOG_FILE), { recursive: true });
    appendFileSync(GEMINI_LOG_FILE, line + "\n");
  } catch { /* 로그 실패는 무시 */ }

  console.log(`[gemini] ${entry.ts} ${level} | ${event}`, payload ?? "");
}
```

### 10.3 로그 이벤트 목록

| 이벤트 | 시점 | payload |
|--------|------|---------|
| `gemini:init` | 서버 시작 시 싱글톤 초기화 | `{ model, limits: {rpm,rpd,tpm} }` |
| `gemini:shutdown` | 서버 종료 시 (graceful) | `{ rpdUsed, uptimeMs }` |
| `gemini:acquire:ok` | acquire() 통과 | `{ rpdCount, rpmCurrent, tpmCurrent }` |
| `gemini:acquire:rpm-wait` | RPM 한도 → sleep 진입 | `{ rpmCurrent, waitMs }` |
| `gemini:acquire:tpm-wait` | TPM 90% → sleep 진입 | `{ tpmCurrent, tpmLimit, waitMs }` |
| `gemini:acquire:rpd-exhausted` | RPD 소진 → throw | `{ rpdCount, rpdLimit }` |
| `gemini:record` | record() 후 사용량 갱신 | `{ tokens, rpdCount, rpmCurrent, tpmCurrent }` |
| `gemini:daily-reset` | PT 자정 날짜 변경 감지 | `{ previousDate, newDate, previousRpdCount }` |
| `gemini:api:call` | LLM invoke 직전 | `{ prompt(앞200자), model }` |
| `gemini:api:response` | LLM invoke 직후 | `{ tokens, durationMs, response(앞200자) }` |
| `gemini:api:error` | LLM invoke 실패 | `{ error, durationMs }` |

### 10.4 로그 출력 예시 (`gemini.log`)

```jsonl
{"ts":"2026-04-16T09:00:01.123Z","level":"INFO","event":"gemini:init","payload":{"model":"gemini-2.5-flash","limits":{"rpm":10,"rpd":250,"tpm":250000}}}
{"ts":"2026-04-16T09:00:02.456Z","level":"INFO","event":"gemini:acquire:ok","payload":{"rpdCount":1,"rpmCurrent":1,"tpmCurrent":0}}
{"ts":"2026-04-16T09:00:02.457Z","level":"INFO","event":"gemini:api:call","payload":{"prompt":"트렌드:\n오늘 한국 20대 여성 쇼핑...","model":"gemini-2.5-flash"}}
{"ts":"2026-04-16T09:00:04.789Z","level":"INFO","event":"gemini:api:response","payload":{"tokens":1523,"durationMs":2332,"response":"[{\"category\":\"럭셔리 시계\",\"them..."}}
{"ts":"2026-04-16T09:00:04.790Z","level":"INFO","event":"gemini:record","payload":{"tokens":1523,"rpdCount":1,"rpmCurrent":1,"tpmCurrent":1523}}
{"ts":"2026-04-16T09:00:05.100Z","level":"WARN","event":"gemini:acquire:rpm-wait","payload":{"rpmCurrent":10,"waitMs":55400}}
```

### 10.5 rateLimitedInvoke()에 로그 통합

```ts
export async function rateLimitedInvoke(llm, messages) {
  await geminiLimiter.acquire();                              // acquire 로그 내부 발생

  const promptText = messages.map(m => m.content).join("\n");
  geminiLog("INFO", "gemini:api:call", {
    prompt: promptText.slice(0, 200),
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  });

  const start = Date.now();
  try {
    const result = await llm.invoke(messages);
    const tokens = result.usage_metadata?.total_tokens ?? estimateTokens(result.content);
    geminiLog("INFO", "gemini:api:response", {
      tokens,
      durationMs: Date.now() - start,
      response: String(result.content).slice(0, 200),
    });
    geminiLimiter.record(tokens);                             // record 로그 내부 발생
    return result;
  } catch (e) {
    geminiLog("ERROR", "gemini:api:error", {
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    });
    throw e;
  }
}
```

### 10.6 기존 `agent.log`와의 관계

| 파일 | 대상 | 환경변수 |
|------|------|---------|
| `data/agent.log` | LangGraph 워크플로우 전체 (노드 진입/종료, LLM 콜백 전문) | 항상 활성 |
| `data/gemini.log` | Gemini 쿼터 관리 전용 (acquire/record/usage 변동) | `GEMINI_LOG=true` |

`agent.log`는 디버깅용 전문 기록, `gemini.log`는 쿼터 운영 모니터링용. 역할이 다르므로 분리 유지.
