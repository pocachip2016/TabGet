# TabGet 프론트–백엔드 연동 작업 계획 (connection.md)

작성일: 2026-04-15
대상 브랜치: `feature/connection`

이 문서는 **현재 코드베이스 실측** 을 기준으로, 남아 있는 연동 작업을
**클라이언트에서 단계별로 확인 가능하게** 진행할 수 있도록 순서·검증 방법까지
명시한 실행 계획이다.

---

## 0. 현재 상태 실측 요약

### 0.1 백엔드 (`backend/src/index.ts`, `backend/prisma/schema.prisma`)
| 항목 | 상태 |
|---|---|
| `GET /polls?visitorId=` | ✅ ACTIVE 5개 + `votesA/votesB` 집계 + `votedPollIds` 반환 (index.ts:106–139) |
| `POST /polls/:id/vote` | ✅ `{side, visitorId}` 수신, 409(중복)/423(마감) 처리 (index.ts:150–178) |
| `POST /run-curation` | ✅ 에이전트 실행 → `PENDING` 저장 (index.ts:96–100) |
| Admin API | ✅ `/admin/polls`, `/admin/polls/:id/status`, `/admin/polls/activate-pending`, `/admin/trend-logs` |
| 스케줄러 | ✅ node-cron, `Asia/Seoul` 타임존 (index.ts:83–91) |
| CORS | ✅ `origin: true` (index.ts:15) |
| `Vote` 스키마 | ⚠️ `visitorId String @default(uuid())` — body 누락 시 랜덤 UUID로 저장되어 유니크 제약이 사실상 무력화 (schema.prisma:30) |
| 마감 윈도우 서버 검증 | ⚠️ `new Date().getHours() === 0` — **서버 로컬 TZ 의존**. 프로세스 TZ가 UTC면 KST 09–10시가 마감되는 버그 (index.ts:154) |

### 0.2 프론트 (`tabget-app/src/`)
| 항목 | 상태 |
|---|---|
| Vite 프록시 `/api → :3000` | ✅ (`vite.config.js`) |
| API 모듈 | ✅ `src/api/client.js` (`fetchPolls`, `submitVote`, Admin 함수들, `ApiError`) |
| `visitorId` 발급/보관 | ✅ `src/lib/visitor.js` (localStorage `tabget:visitorId`) |
| `App.jsx` 데이터 로딩 | ✅ `fetchPolls(visitorId)` → `polls` + `votedPollIds` state (App.jsx:180–196) |
| 중복 투표 UI 차단 | ✅ `hasCurrentVoted` → "이미 응모하셨어요" 안내 (App.jsx:199, 230–235) |
| 투표 제출 + Optimistic | ✅ 409/423 에러 분기 + 롤백 (App.jsx:302–349) |
| `VS_DATA` mock | ⚠️ 메인 화면에서는 미사용이지만 `screen === 'results'` 분기에서 여전히 사용 (App.jsx:411) |
| **자정 카운트다운 / CLOSED 오버레이** | ❌ 미구현 (plan2.md 후반부) |
| **이미 투표한 poll 자동 스킵** | ❌ `currentIndex=0`부터 시작, `nextSet`이 `% polls.length` 순환 (App.jsx:361–371) |
| **Exhausted 엔드 스크린** | ❌ "모두 응모하셨습니다" 상태 없음 |
| **투표 성공 후 자동 다음 전환** | ❌ `isWinnerRevealed=true`만 세팅, 세트 유지 (App.jsx:330) |
| **Results 탭 실제 집계 연동** | ❌ `VS_DATA` 하드코딩 기반 |

### 0.3 핵심 갭 (이 문서가 해결하려는 것)
1. 서버 마감 판정 TZ 안정화 (Asia/Seoul 고정)
2. 서버 `visitorId` 필수화로 중복 투표 차단 실질화
3. 클라 자정 카운트다운 + CLOSED 오버레이
4. 투표한 poll 스킵 + Exhausted 엔드 스크린
5. 투표 성공 2초 후 자동 다음 세트
6. Results 화면을 실제 polls 데이터로 렌더

---

## 1. 작업 원칙

- **한 단계 = 한 가지 관심사**. 각 단계는 독립적으로 커밋·롤백 가능해야 한다.
- **각 단계는 "클라에서 육안으로 확인 가능한 기대 동작"을 명시**한다.
- 백엔드 변경을 포함하는 단계는 **마이그레이션 필요 여부**와 **curl로 단독 검증할 명령**을 포함한다.
- 회귀 방지: 단계 완료 시 기존 시나리오(단일 클릭 선택, 더블탭 투표, 스와이프, 방향 전환)가 깨지지 않음을 수동 확인.

---

## 2. 단계별 계획

### Step A — 서버 타임존·마감 로직 안정화 (백엔드 단독)

**목표:** 자정 마감 판정을 서버 프로세스 TZ와 독립적으로 수행.

**변경 파일**
- `backend/src/index.ts` — `POST /polls/:id/vote` 진입부.

**변경 내용**
```ts
// 한국 시간(KST) 기준 00:00~00:59는 마감
const kstHour = Number(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hour12: false,
  }).format(new Date())
);
if (kstHour === 0) {
  return reply.code(423).send({ error: "voting_closed" });
}
```

**선택:** `GET /voting-window` 엔드포인트를 추가해 클라가 서버 기준 phase/target을 동기화할 수 있게 한다.
```ts
app.get("/voting-window", async () => {
  const now = new Date();
  // Asia/Seoul 기준 hour 계산 (위와 동일 로직 재사용)
  const h = kstHour(now);
  return { phase: h === 0 ? "CLOSED" : "OPEN", serverNow: now.toISOString() };
});
```
> 권고: Step C 전에 먼저 추가. 클라가 기기 시계 대신 서버 시각을 기준점으로 삼도록.

**마이그레이션:** 없음.

**검증**
```bash
# 정상 투표 (현재 시각이 KST 01:00~23:59)
curl -X POST http://localhost:3000/polls/<id>/vote \
  -H 'content-type: application/json' \
  -d '{"side":"A","visitorId":"test-1"}'
# → 200 { id, side, createdAt }

# 마감 구간 시뮬레이션: 서버 프로세스를 TZ=Asia/Seoul 상태로 실행하고
# 시스템 시각을 00:30으로 조작 후 재시도 → 423 { error: "voting_closed" }
```

**클라 확인:** 변경 없음 (회귀 확인용으로만 사용).

---

### Step B — 백엔드 `visitorId` 필수화 + 유니크 제약 실질화

**목표:** 외부 클라이언트가 `visitorId` 없이 중복 투표하는 경로 차단.

**변경 파일**
- `backend/src/index.ts` — 투표 핸들러.
- (선택) `backend/prisma/schema.prisma` — `Vote.visitorId`의 `@default(uuid())` 제거하여 "명시 전달 필수" 의미를 스키마 수준에서도 보장.

**index.ts 변경**
```ts
const { side, visitorId } = req.body;
if (!visitorId || typeof visitorId !== "string") {
  return reply.code(400).send({ error: "visitor_id_required" });
}
if (side !== "A" && side !== "B") {
  return reply.code(400).send({ error: "invalid_side" });
}
const vote = await prisma.vote.create({
  data: { pollId: req.params.id, side, visitorId },
});
```

**schema 변경(선택)**
```prisma
model Vote {
  // ...
  visitorId String   // @default(uuid()) 제거
  // 기존 레코드에 visitorId 이미 채워져 있으므로 downgrade-safe
}
```

**마이그레이션:**
- 스키마 수정 시 `cd backend && npx prisma migrate dev --name require_visitor_id`
- 기존 DB 레코드는 이미 `@default(uuid())`로 채워져 있어 백필 불필요.

**검증**
```bash
# visitorId 누락 → 400
curl -X POST http://localhost:3000/polls/<id>/vote \
  -H 'content-type: application/json' -d '{"side":"A"}'
# → 400 { error: "visitor_id_required" }

# 동일 (pollId, visitorId) 재투표 → 409
curl -X POST ... -d '{"side":"B","visitorId":"same-visitor"}'   # 1회차 200
curl -X POST ... -d '{"side":"A","visitorId":"same-visitor"}'   # 2회차 409
```

**클라 확인:**
- 프론트는 이미 `visitorId` 전송 중 → 영향 없음. 기존 UX 회귀 없음 확인만.

---

### Step C — 클라 자정 카운트다운 유틸 + OPEN/CLOSED 판정

**목표:** 남은 시간을 중앙에 표시하고, CLOSED 구간에서 투표 입력 차단.

**신규 파일**
- `tabget-app/src/lib/time.js`

```js
// 로컬 시간 기준. 서버와의 괴리는 Step C-2에서 /voting-window로 보정.
export function getVotingWindow(now = new Date()) {
  const h = now.getHours();
  if (h === 0) {
    const opensAt = new Date(now);
    opensAt.setHours(1, 0, 0, 0);
    return { phase: 'CLOSED', target: opensAt };
  }
  const endsAt = new Date(now);
  endsAt.setHours(24, 0, 0, 0);
  return { phase: 'OPEN', target: endsAt };
}

export function formatHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh} : ${mm} : ${ss}`;
}
```

**`App.jsx` 변경**
- `now` state + 1초 interval 추가.
- `const win = getVotingWindow(now); const isClosed = win.phase === 'CLOSED';`
- 중앙 오버레이 렌더 (VS 배지 아래 또는 별도 레이어):
  ```jsx
  <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none">
    <div className="text-[10px] tracking-widest text-white/60">남은시간</div>
    <div className="text-2xl font-black tabular-nums">{formatHMS(win.target - now)}</div>
    {isClosed && <div className="text-[10px] text-red-300 mt-1">투표 마감 — 01:00 재오픈</div>}
  </div>
  ```
- `handleClick` / `handleDoubleClick` 진입부에 `if (isClosed) { showToast('투표 마감 — 01:00 재오픈'); return; }` 추가.

**검증 (클라)**
1. `npm run dev` → 카운트다운이 1초마다 감소하고 포맷이 `HH : MM : SS`.
2. 시스템 시계를 00:30으로 변경 → 오버레이가 "투표 마감" 표시.
3. CLOSED 상태에서 더블탭 → 빨간 토스트 "투표 마감" + 투표 미발생(Network 탭에서 `POST /polls/.../vote` 미호출).

**Step C-2 (선택 강화):** 마운트 시 `GET /voting-window`로 `phase` 초기 보정, 이후 주기적으로 재싱크.

---

### Step D — 투표 성공 후 2초 뒤 자동 다음 세트 전환

**목표:** plan2.md의 "2초 뒤 자동 nextSet" UX 구현.

**변경 파일**
- `tabget-app/src/App.jsx` — `handleDoubleClick` 의 성공 분기.

**변경 내용**
```jsx
await submitVote(pollId, side, visitorIdRef.current);
setVotedPollIds((ids) => ids.includes(pollId) ? ids : [...ids, pollId]);
setTimeout(() => setIsWinnerRevealed(true), 2000);
// 추가: Winner 공개 후 1.2초 뒤 다음 세트
setTimeout(() => nextSet(), 3200);
```
> 타이머 레퍼런스는 `autoAdvanceTimerRef` 로 관리해 언마운트·수동 네비게이션 시 `clearTimeout`.

**주의:** `nextSet` 은 다음 Step E에서 "미투표 poll로 건너뛰기"로 확장되므로, 순서상 E 먼저 구현 후 D의 자동 전환을 붙이는 편이 자연스럽다. → **순서 재조정 권고: E → D**.

**검증**
- 더블탭 → 즉시 Optimistic UI → 2초 후 Trophy → 추가 1.2초 후 다음 세트로 전환.
- 전환 직전 수동 스와이프로 넘겼을 때 타이머가 중복 발화하지 않는지 확인.

---

### Step E — 투표한 poll 자동 스킵 + Exhausted 엔드 스크린

**목표:** 초기 진입 시 미투표 poll로 바로 이동, 모두 소진 시 엔드 스크린 고정.

**변경 파일**
- `tabget-app/src/App.jsx`

**변경 내용**
1. `remainingPolls` 파생값:
   ```js
   const remainingPolls = polls.filter(p => !votedPollIds.includes(p.id));
   const isExhausted = polls.length > 0 && remainingPolls.length === 0;
   ```
2. 초기 `currentIndex` 설정: `fetchPolls` 응답 처리에서
   ```js
   const firstUnvotedIdx = data.polls.findIndex(p => !(data.votedPollIds ?? []).includes(p.id));
   setCurrentIndex(firstUnvotedIdx === -1 ? 0 : firstUnvotedIdx);
   ```
3. `nextSet` / `prevSet` 을 "미투표 poll 중에서 순환"하도록 수정:
   ```js
   const nextUnvotedIndex = (from) => {
     for (let i = 1; i <= polls.length; i++) {
       const idx = (from + i) % polls.length;
       if (!votedPollIds.includes(polls[idx].id)) return idx;
     }
     return from; // 전부 투표됨
   };
   ```
4. 렌더 분기:
   ```jsx
   if (isExhausted) return <ExhaustedScreen />;
   ```
   `ExhaustedScreen` 내용: "모두 응모하셨습니다 🎉 / 내일 01:00에 새 라운드가 열려요" + 스와이프/클릭 핸들러 전부 early-return.

**검증**
1. DevTools → Application → Local Storage 의 `tabget:visitorId` 삭제 후 새로고침 → 첫 번째 poll부터 시작.
2. 3개 투표 → 새로고침 → 4번째(미투표) poll로 바로 진입.
3. 5개 모두 투표 → 새로고침 → "모두 응모하셨습니다" 엔드 스크린 + 스와이프/더블탭 무반응.
4. 시크릿 창 재접속 → 새 `visitorId` → 다시 1번 poll부터.

---

### Step F — Results 화면 실제 데이터 연동

**목표:** `screen === 'results'` 에서 사용 중인 `VS_DATA` 하드코딩 제거.

**변경 파일**
- `tabget-app/src/App.jsx` — results 분기 (App.jsx:382–495).

**변경 내용**
- `polls` state (이미 로드됨) 를 재사용:
  ```jsx
  {polls.map((p) => {
    const total = p.votesA + p.votesB;
    const pA = total > 0 ? Math.round((p.votesA / total) * 100) : 50;
    const pB = total > 0 ? 100 - pA : 50;
    // ...
  })}
  ```
- 모듈 상단 `VS_DATA` 상수 및 main 화면 mock 제거 (이미 main에서 미사용).
- Winner 후기 섹션은 현재 하드코딩 `WINNERS` 유지 (후속 과제).

**검증**
- Splash → 당첨결과 진입 → 실제 ACTIVE poll들이 브랜드/득표율과 함께 렌더.
- ACTIVE poll이 0개일 때 "결과 없음" 빈 상태 표시.

---

### Step G — (선택) 실시간 폴링

**목표:** 투표 후 타인의 투표 증가분도 반영.

**변경 파일**
- `tabget-app/src/App.jsx`

**변경 내용**
- `useEffect` 에서 `setInterval(() => fetchPolls(visitorId).then(...), 15_000)` — 화면이 main일 때만.
- 응답 머지 시 내 `votedPollIds` 는 서버 응답을 source of truth 로 사용.

**검증:** 두 탭을 열고 각기 다른 `visitorId` 로 투표 → 15초 내 상대 탭에도 카운트 반영.

> SSE 버전은 본 문서 범위 외.

---

## 3. 커밋/브랜치 운용 권고

각 Step을 독립 커밋으로 분리. 제안 순서(E가 D보다 먼저):

1. `feat(backend): use Asia/Seoul for vote window check` (Step A)
2. `feat(backend): require visitorId on vote submission` (Step B)
3. `feat(web): countdown & closed overlay` (Step C)
4. `feat(web): skip voted polls and add exhausted screen` (Step E)
5. `feat(web): auto-advance after successful vote` (Step D)
6. `feat(web): render results from live poll data` (Step F)
7. `feat(web): poll /polls every 15s for live tally` (Step G, 선택)

---

## 4. 회귀 체크리스트 (각 Step 후 공통)

- [ ] Portrait/Landscape 방향 전환 시 레이아웃 정상
- [ ] 단일 클릭 → 선택 링/퍼센트 바 정상
- [ ] 더블탭 → 하트 애니메이션 + vibrate
- [ ] 스와이프 네비게이션 동작
- [ ] 이미 투표한 세트 단일 클릭 → "이미 응모하셨어요"
- [ ] 로딩/에러/빈 상태 화면 정상
- [ ] Splash → main → results → main 왕복 정상

---

## 5. 발견된 이슈 목록 (본 계획 범위 외, 차후 처리)

- 투표수 실시간 broadcast (SSE/WebSocket)
- 이메일 기반 재접속 자동 로그인 (다기기/시크릿 대응)
- `PENDING → ACTIVE` 자동 전환 (현재 수동 `/admin/polls/activate-pending`)
- Results 화면 당첨자 후기 섹션 실데이터화
- 서버 로그 레벨 제어, rate-limit, abuse 방지
