# TabGet 프론트-백엔드 연동 계획

## 현황 요약

| 항목 | 현재 상태 |
|---|---|
| 프론트 데이터 | `VS_DATA` 하드코딩 mock |
| 투표 제출 | 로컬 state만 변경, API 미호출 |
| 백엔드 | Fastify + Prisma, API 완성 상태 |
| DB 스키마 | `Poll`, `Vote`, `TrendLog` |

---

## 백엔드 API 정리

```
GET  /polls              → ACTIVE 투표 목록 (최대 5개)
POST /polls/:id/vote     → { side: "A" | "B" } 투표 제출
POST /run-curation       → AI 에이전트로 투표 세트 생성 (관리용)
GET  /serper-status      → Serper API 상태 확인
```

`Poll` 오브젝트 구조 (백엔드 응답):
```ts
{
  id: string
  category: string
  themeTitle: string
  productA: { brand, name, features: string[], imageUrl, videoUrl? }
  productB: { brand, name, features: string[], imageUrl, videoUrl? }
  curatorNote?: string
  status: "PENDING" | "ACTIVE" | "ARCHIVED"
  scheduledAt: string
  votes: Vote[]
}
```

---

## 연동 작업 단계

### Step 1 — Vite 프록시 설정
**파일:** `tabget-app/vite.config.js`

개발 환경에서 CORS 없이 백엔드 호출하도록 프록시 추가:
```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      rewrite: (path) => path.replace(/^\/api/, ''),
    }
  }
}
```
프론트에서 `/api/polls` 호출 → 백엔드 `localhost:3000/polls`로 포워딩

---

### Step 2 — API 레이어 모듈 생성
**파일 (신규):** `tabget-app/src/api.js`

```js
const BASE = '/api'

export const fetchPolls = () =>
  fetch(`${BASE}/polls`).then(r => r.json())

export const submitVote = (pollId, side) =>
  fetch(`${BASE}/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side }),
  }).then(r => r.json())
```

---

### Step 3 — 백엔드 `GET /polls` 응답에 집계 투표수 추가
**파일:** `backend/src/index.ts`

현재 `/polls`는 `Vote[]` 배열만 포함. 프론트에서 매번 집계하지 않도록
백엔드에서 `_count` 또는 직접 집계해서 내려줌:

```ts
// 각 poll에 votesA, votesB 필드 추가
const polls = await prisma.poll.findMany({ ... })
// votes 배열에서 A/B 카운트 → { ...poll, votesA, votesB }
```

또는 Prisma `_count` groupBy 활용 검토.

---

### Step 4 — `App.jsx` 데이터 로딩 연결
**파일:** `tabget-app/src/App.jsx`

- `VS_DATA` 하드코딩 제거
- `useEffect`에서 `fetchPolls()` 호출 → `polls` state 저장
- 로딩 중 스피너 / polls 빈 배열일 때 empty state 처리
- `currentSet`이 `polls[currentIndex]` 참조하도록 변경
- `productA.imageUrl` → `imgA`, `productA.name` → `itemA` 등 필드명 매핑

```jsx
const [polls, setPolls] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetchPolls().then(data => {
    setPolls(data)
    setLoading(false)
  })
}, [])

const currentSet = polls[currentIndex]
```

---

### Step 5 — 투표 제출 연결
**파일:** `tabget-app/src/App.jsx`

`handleDoubleClick`에서 `submitVote(currentSet.id, side)` 호출:

```jsx
const handleDoubleClick = async (side, e) => {
  // 기존 로컬 state 업데이트 유지 (즉각적인 UI 반응)
  setVotedSide(side)
  ...
  // 백엔드에 비동기 제출 (실패해도 UX 방해 안 함)
  submitVote(currentSet.id, side).catch(console.error)
}
```

---

### Step 6 — 투표수 실시간 반영 (선택 구현)
현재 프론트는 투표수를 mock 카운트업 + 랜덤 증가로 시뮬레이션.
백엔드 연동 후 두 가지 방향 중 선택:

**옵션 A (폴링):** 투표 후 일정 간격으로 `GET /polls` 재호출
- 장점: 구현 단순
- 단점: 네트워크 낭비

**옵션 B (Server-Sent Events):** 백엔드에 `/polls/stream` SSE 엔드포인트 추가
- 장점: 진짜 실시간
- 단점: 백엔드 추가 구현 필요

→ **1차 연동은 옵션 A(폴링)** 으로 구현, 이후 SSE로 업그레이드

---

## 작업 순서 및 우선순위

| 순서 | 작업 | 파일 | 중요도 |
|---|---|---|---|
| 1 | Vite 프록시 설정 | `vite.config.js` | 필수 |
| 2 | API 레이어 생성 | `src/api.js` (신규) | 필수 |
| 3 | 백엔드 투표수 집계 추가 | `backend/src/index.ts` | 필수 |
| 4 | 데이터 로딩 연결 | `src/App.jsx` | 필수 |
| 5 | 투표 제출 연결 | `src/App.jsx` | 필수 |
| 6 | 실시간 투표수 폴링 | `src/App.jsx` | 선택 |

---

## 고려사항

- **DB에 ACTIVE 투표가 없을 때:** `/run-curation` 먼저 실행 후 상태를 PENDING→ACTIVE로 변경하는 관리 흐름 필요. 현재 백엔드는 자동 전환 로직 없음.
- **필드명 불일치:** 프론트 `itemA/imgA` ↔ 백엔드 `productA.name/imageUrl` — Step 4에서 매핑 처리.
- **에러 핸들링:** API 실패 시 mock 데이터로 fallback 여부 결정 필요.
- **CORS:** 프로덕션 배포 시 백엔드에 CORS 허용 헤더 추가 필요 (현재 개발은 Vite 프록시로 우회).

---

# [추가] 익명 Visitor ID 기반 1인 1투표

## 배경
현재 `POST /polls/:id/vote`는 사용자 식별자 없이 `{ side }`만 받아 `Vote`를 생성한다 (`backend/src/index.ts`, `Vote` 모델 `backend/prisma/schema.prisma`). 따라서 같은 사람이 같은 poll에 몇 번이든 투표할 수 있고, "특정 사용자가 특정 세션에 폴했는지"를 알 방법이 없다.

목표: **이메일/로그인 없이** 브라우저 단위로 "이 방문자가 이 poll에 이미 투표했는가"를 식별하고,
- 이미 투표한 set은 자동으로 다음 poll로 스와이프
- 모든 poll을 소진했을 땐 "모두 응모하셨습니다" 상태로 스와이프 중지

(이메일 기반 재접속 자동 로그인 UX는 후속 과제로 보류.)

## 설계 요약
- 프론트 최초 로드 시 `localStorage`에 `visitorId` (UUID v4) 발급·저장
- 모든 투표 요청에 `visitorId` 동봉
- DB에서 `(pollId, visitorId)` 유니크로 중복 차단
- `GET /polls?visitorId=...` 응답에 "내가 투표한 poll id 목록"(`votedPollIds`) 포함 → 초기 렌더에서 이미 투표한 set 스킵
- 남은 poll이 0개면 엔드 스크린(“모두 응모하셨습니다”) 고정, 스와이프/더블탭 비활성화

## 수정 대상 파일
| 파일 | 변경 |
|---|---|
| `backend/prisma/schema.prisma` | `Vote`에 `visitorId String` + `@@unique([pollId, visitorId])` + `@@index([visitorId])` |
| `backend/src/index.ts` | `POST /polls/:id/vote`에서 `visitorId` 수신·저장, 유니크 위반 시 409. `GET /polls`에서 `?visitorId=` 수신 시 `votedPollIds`를 응답에 포함 (Step 3 집계와 함께) |
| `tabget-app/vite.config.js` | `/api` → `localhost:3000` 프록시 (Step 1) |
| `tabget-app/src/lib/visitor.js` (신규) | `getVisitorId()` — localStorage(`tabget:visitorId`)에 없으면 `crypto.randomUUID()`로 생성·저장·반환 |
| `tabget-app/src/api.js` (신규) | `fetchPolls(visitorId)`, `submitVote(pollId, side, visitorId)` |
| `tabget-app/src/App.jsx` | `VS_DATA` 제거. 마운트 시 `getVisitorId()` → `fetchPolls` → `polls`/`votedPollIds` state. `currentIndex`는 *미투표* poll 기준. `handleDoubleClick`에서 `submitVote` 호출 → 성공 시 `votedPollIds`에 pollId 추가, 2초 뒤 자동 `nextSet()`. 남은 미투표 poll이 0이면 `isExhausted=true` — 스와이프/더블탭 차단, 엔드 스크린 렌더 |

## 주요 데이터 플로우
```
App mount
  └─ visitorId = getVisitorId()            // localStorage
  └─ GET /api/polls?visitorId=<id>
       → { polls: [...], votedPollIds: [...] }
  └─ remaining = polls.filter(p => !votedPollIds.includes(p.id))
  └─ remaining.length === 0 ? <Exhausted/> : render

Double-tap (투표)
  └─ POST /api/polls/:id/vote  { side, visitorId }
       ├─ 200 → votedPollIds.add(id); 2s 후 nextSet()
       └─ 409 (이미 투표) → votedPollIds.add(id); 즉시 nextSet()
  └─ 다음 미투표 poll이 없으면 Exhausted 전환
```

## 백엔드 스키마 변경 (핵심 diff)
```prisma
model Vote {
  id        String   @id @default(uuid())
  pollId    String
  visitorId String
  side      String
  createdAt DateTime @default(now())
  poll      Poll     @relation(fields: [pollId], references: [id])

  @@unique([pollId, visitorId])
  @@index([visitorId])
}
```
마이그레이션: `npx prisma migrate dev --name add_visitor_id`. 기존 레코드가 있다면 `visitorId`를 `"legacy-" || id` 같은 더미로 백필 후 유니크 적용.

## 엔드 스크린
- `remaining.length === 0` → 중앙에 "모두 응모하셨습니다" + 다음 라운드 안내
- `onTouchStart/End` 스와이프 핸들러, `handleClick/DoubleClick` 전부 early-return
- 카운트다운 타이머 표시 여부는 선택

## 한계 / 비-목표
- **localStorage 삭제·시크릿 모드·다른 브라우저** → 별개 방문자로 취급되어 재투표 가능. 이번 범위에서는 수용 (후속 "이메일 자동 로그인"에서 해결)
- 신규 poll 롤인 시 Exhausted 해제는 **새로고침 시 재평가**. 실시간 폴링(Step 6 옵션 A)은 본 범위 외
- CORS: 개발은 Vite 프록시로 회피, 프로덕션은 별도

## 검증 방법
1. `cd backend && npx prisma migrate dev --name add_visitor_id && npm run dev`
2. `cd tabget-app && npm run dev` → `http://localhost:5173`
3. DevTools → Application → Local Storage에 `tabget:visitorId` 생성 확인
4. poll 더블탭 → Network에서 `POST /api/polls/:id/vote` 바디에 `visitorId` 포함 확인, 2초 뒤 다음 poll 자동 전환
5. 같은 poll에 재투표 시도 (curl/DevTools) → 409 확인
6. 모든 poll 소진 후 "모두 응모하셨습니다" 화면 + 스와이프/더블탭 무반응 확인
7. 시크릿 창 재접속 → 새 `visitorId`, 동일 poll 재투표 가능(별개 방문자) 확인
8. `SELECT "pollId","visitorId", COUNT(*) FROM "Vote" GROUP BY 1,2 HAVING COUNT(*)>1;` → 0행

---

# [추가] 일일 투표 윈도우 + 자정 카운트다운 + 투표 시각 기록

## 배경
투표는 **매일 00:00(자정)에 마감**되고 **01:00에 다음 라운드가 시작**된다. 00:00~01:00은 휴식 구간. 화면 중앙에는 자정까지 남은 시간을 초 단위로 실시간 표시한다. 또한 각 투표의 정확한 제출 시각을 DB에 기록해 트렌드/시간대 분석에 활용한다.

## 설계 요약
- **종료 기준:** 로컬 타임존 기준 다음 00:00:00. 현재 시각이 00:00~01:00 사이면 "휴식 중 — 01:00 오픈" 상태.
- **카운트다운 (항상 표시):** `setInterval(1s)`로 재계산. 포맷 `HH : mm : ss`. 라벨은 **항상 "남은시간"**.
  - `OPEN` (01:00~23:59): 다음 **00:00**까지 남은 시간
  - `CLOSED` (00:00~00:59): 다음 **01:00**까지 남은 시간 (재오픈까지)
- **투표 차단:** `CLOSED` 구간에선 더블탭/스와이프 무효 + "투표 마감 — 재오픈까지" 서브텍스트. 카운트다운 자체는 계속 흘러감.
- **투표 시각 기록:** `Vote.createdAt`은 이미 존재 → 그대로 활용. 추가로 `votedAt`(명시적 필드)을 두지 않고 `createdAt`을 정식 투표 시각으로 간주. 프론트는 `submitVote` 응답에서 `createdAt`을 받아 UI에 반영 가능.

## 수정 대상 파일
| 파일 | 변경 |
|---|---|
| `tabget-app/src/lib/time.js` (신규) | `getVotingWindow(now)` → `{ phase: "OPEN" \| "CLOSED", endsAt: Date, opensAt: Date }`. 00:00~01:00이면 CLOSED, 그 외엔 OPEN이고 `endsAt`은 다음 자정 |
| `tabget-app/src/App.jsx` | 상단 타이머 대신(또는 함께) **중앙 오버레이 카운트다운**. `useEffect`에서 1초 간격 갱신. `phase === "CLOSED"`면 "오늘 투표 마감 — 01:00 재오픈" 표시하고 더블탭/스와이프 차단. 카운트다운 0 도달 시 즉시 CLOSED 전환 |
| `backend/src/index.ts` | `POST /polls/:id/vote`에서 서버 시각 기준으로도 윈도우 검증 (00:00~01:00이면 423/409 반환). 응답에 `{ id, side, createdAt }` 포함 |
| `backend/prisma/schema.prisma` | `Vote.createdAt`을 그대로 "투표 시각"으로 사용. 별도 필드 불필요. 인덱스 필요 시 `@@index([createdAt])` 추가 (시간대 집계용) |

## 카운트다운 로직 (프론트 예시)
```js
// src/lib/time.js
export function getVotingWindow(now = new Date()) {
  const h = now.getHours();
  if (h === 0) {
    // CLOSED: 01:00 재오픈까지 카운트다운
    const opensAt = new Date(now); opensAt.setHours(1, 0, 0, 0);
    return { phase: "CLOSED", target: opensAt };
  }
  // OPEN: 다음 00:00 마감까지 카운트다운
  const endsAt = new Date(now); endsAt.setHours(24, 0, 0, 0);
  return { phase: "OPEN", target: endsAt };
}

export function formatHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh} : ${mm} : ${ss}`;
}
```

```jsx
// App.jsx
const [now, setNow] = useState(() => new Date());
useEffect(() => {
  const t = setInterval(() => setNow(new Date()), 1000);
  return () => clearInterval(t);
}, []);
const win = getVotingWindow(now);
const remaining = win.target - now; // OPEN=자정까지, CLOSED=01시까지
// 중앙 오버레이:
// <div className="center-countdown">
//   <div className="label">남은시간</div>
//   <div className="time">{formatHMS(remaining)}</div>
//   {win.phase === "CLOSED" && <div className="sub">투표 마감 — 재오픈까지</div>}
// </div>
```

## 백엔드 윈도우 검증
```ts
// POST /polls/:id/vote 진입부
const h = new Date().getHours();
if (h === 0) return reply.code(423).send({ error: "voting_closed" });
// ...기존 로직
const vote = await prisma.vote.create({ data: { pollId, visitorId, side } });
return { id: vote.id, side: vote.side, createdAt: vote.createdAt };
```
→ 프론트는 423 수신 시 CLOSED 오버레이로 강제 전환.

## 엣지 케이스
- **탭 백그라운드 → 복귀:** `setInterval`이 멈추진 않지만 드리프트 가능 → 매 틱마다 `new Date()` 재계산이므로 자연 보정됨
- **기기 시계 오차:** 서버 검증이 최종 판단. 프론트는 UX용
- **타임존:** 로컬 기준. 해외 방문자도 "자기 자정" 기준으로 마감. 서버와 괴리 발생 가능 → 1차는 수용, 필요 시 `Asia/Seoul` 고정으로 통일 검토
- **00:00 정각 투표 레이스:** 서버가 `h === 0`로 차단하므로 클라 지연 투표도 거부됨

## 검증 방법
1. 시스템 시간을 23:59:55로 설정 → 5초 후 카운트다운 0, CLOSED 오버레이 전환 확인
2. 00:30에 더블탭 → 423 응답, 오버레이 유지
3. 01:00 이후 정상 투표 → `Vote.createdAt`이 실제 시각과 일치 (`SELECT createdAt FROM "Vote" ORDER BY createdAt DESC LIMIT 5;`)
4. 중앙 카운트다운이 1초마다 1씩 감소하는지 육안 확인
