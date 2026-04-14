# TabGet 코드베이스 리서치 보고서

> 작성일: 2026-04-14 (v2: 백엔드 자율 큐레이션 에이전트 계획 통합)  
> 분석 대상: `/home/ktalpha/Work/TabGet` (프론트엔드 구현 + 백엔드 설계 문서 `research2.md` 통합)

---

## 1. 프로젝트 개요

**TabGet**은 모바일 퍼스트 제품 비교 투표 앱이다. 두 상품을 나란히 보여주고, 사용자가 더블탭으로 투표하는 방식이다. KT 알파쇼핑 브랜드 컬러(`#E30B5C`)를 사용하는 것으로 보아 KT 알파쇼핑 이벤트 참여 앱으로 기획된 것으로 보인다.

**스택**: React 19.2.4 + Vite 8 + Tailwind CSS 4.2.2 + Lucide React 1.7.0  
**배포**: GitHub Pages (`/TabGet/` 서브디렉토리)  
**PWA**: standalone 모드, 세로/가로 모두 지원

### 1.1 시스템 아키텍처 (2-티어, 백엔드 미구축)

| 레이어 | 상태 | 역할 |
|--------|------|------|
| **Frontend** (`tabget-app/`) | 구현됨 | React 19 + Vite, 사용자 투표 UI, 현재는 mock 데이터 사용 |
| **Backend** (자율 큐레이션 에이전트) | 설계 단계 — § 18 참조 | Node.js + LangGraph → PostgreSQL, 실시간 트렌드 기반 Poll 자동 생성 |
| **Orchestration** | 설계 단계 | n8n으로 일일 스케줄 실행 |

---

## 2. 디렉토리 구조

```
TabGet/
├── CLAUDE.md                          # Claude Code 개발 가이드
├── README.md                          # 한국어 개발 스펙
├── research.md                        # 이 파일
├── .github/workflows/deploy.yml       # GitHub Pages 자동 배포 CI/CD
├── .claude/settings.local.json        # Claude Code 권한 설정
└── tabget-app/
    ├── package.json
    ├── vite.config.js                 # base: '/TabGet/'
    ├── index.html                     # PWA 메타태그, viewport-fit=cover
    ├── eslint.config.js
    ├── public/
    │   ├── manifest.json              # PWA 매니페스트
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── main.jsx                   # React DOM 진입점
        ├── App.jsx                    # 앱 전체 로직 (~577줄)
        ├── SplashScreen.jsx           # 스플래시 화면 (~140줄)
        ├── index.css                  # 글로벌 애니메이션 + 리셋
        └── App.css                    # 미사용 레거시 스타일
```

---

## 3. 화면 구성 (3개 스크린)

앱은 `screen` 상태값으로 3개 화면을 전환한다.

| 상태값 | 화면 | 전환 조건 |
|--------|------|-----------|
| `'splash'` | 스플래시 (초기값) | 8초 카운트다운 or 클릭 |
| `'main'` | VS 투표 화면 | splash → main |
| `'results'` | 결과 / 당첨자 화면 | splash "결과보기" 버튼 |

---

## 4. 데이터 구조

### VS_DATA (5세트 mock)

```javascript
{
  id: 1,
  itemA: "프리미엄 무선 이어폰",
  itemB: "최신형 스마트워치",
  imgA: "https://images.unsplash.com/...",
  imgB: "https://images.unsplash.com/...",
  votesA: 12450,
  votesB: 11820,
}
```

5개 세트는 순환 구조 (4 → 0 → 1 ... 방식으로 wrap).

### CHAT_MESSAGES (20개)
한국어 채팅 메시지 풀. 예: "이거 진짜 최고다 👍", "압도적 1위!", "완전 내 스타일 ❤️"

### NICKNAMES (15개)
한국어 익명 닉네임 풀. 예: "익명의곰돌이", "행운의별빛", "구름위의고양이"

---

## 5. 상태 관리

모든 상태는 App.jsx에 flat하게 관리된다. Context API, Redux 없음.

### 주요 상태 변수

| 변수 | 타입 | 용도 |
|------|------|------|
| `screen` | string | 화면 전환 ('splash' / 'main' / 'results') |
| `isPortrait` | boolean | 세로/가로 레이아웃 전환 |
| `currentIndex` | number | 현재 VS 세트 인덱스 (0-4) |
| `selectedSide` | 'A' / 'B' / null | 사용자가 선택(hover 상태)한 쪽 |
| `votedSide` | 'A' / 'B' / null | 최종 투표(더블탭)한 쪽 |
| `showHeart` | `{active, x, y}` | 하트 애니메이션 위치/표시 여부 |
| `isWinnerRevealed` | boolean | 당첨 엠블럼 표시 여부 |
| `showAlreadyVoted` | boolean | "이미 투표" 알림 표시 여부 |
| `displayVotesA/B` | number | 화면에 표시되는 투표수 (애니메이션 용) |

### 주요 Ref 변수

| Ref | 용도 |
|-----|------|
| `alreadyVotedTimerRef` | "이미 투표" 메시지 타이머 |
| `heartTimeoutRef` | 하트 애니메이션 타이머 |
| `liveIntervalRef` | 실시간 투표수 증가 인터벌 |
| `animFrameRef` | requestAnimationFrame 취소용 |

---

## 6. 인터랙션 상세

### 6.1 단일 클릭 (선택)

`handleClick(side)` — App.jsx:174

1. 이미 선택된 쪽 클릭 시 무시
2. 이미 다른 쪽에 투표한 상태에서 반대쪽 클릭 시 "이미 투표" 알림 (2.5초)
3. `selectedSide` 설정 → 해당 쪽 ring 강조, 반대쪽 opacity 70%
4. 투표수 애니메이션 시작: 0 → targetVotes (1초, easeOutCubic)
5. 애니메이션 완료 후 1초마다 +1~+5 실시간 증가 시작

### 6.2 더블 클릭 (투표)

`handleDoubleClick(side, e)` — App.jsx:238

1. `votedSide` 설정 (최종 투표 기록)
2. 클릭 좌표에 하트 애니메이션 생성 (`animate-ping`, 800ms)
3. 햅틱 피드백 `navigator.vibrate(80)` (80ms 진동)
4. 2000ms 후 당첨 엠블럼 표시 (`isWinnerRevealed = true`)

### 6.3 세트 이동

`nextSet()` / `prevSet()` — App.jsx:263

- 순환 구조: `(index + 1) % 5`
- 이동 시 모든 상태 초기화 (`resetSet()`)
- 투표 완료 후 좌우 버튼이 `animate-blink` 시작 (이동 유도)

### 6.4 채팅 피드

`ChatFeed` 컴포넌트 — App.jsx:83

- `active` prop이 true일 때만 활성화 (선택된 쪽에만 표시)
- 1.2~2.0초 랜덤 간격으로 새 메시지 추가
- 최대 6개 유지, 화면에 마지막 3개만 표시
- opacity 점진: 0.4 → 0.7 → 1.0 (오래된 것이 더 투명)
- 슬라이드업 애니메이션 (CSS `slideUp`, 0.35s)

---

## 7. 시각적 피드백 상태 정리

| 상황 | 선택된 쪽 | 반대쪽 |
|------|-----------|--------|
| 아무것도 선택 안 함 | opacity-100 | opacity-100 |
| 선택만 함 (클릭) | opacity-100 + ring-4 red | opacity-70 |
| 투표 완료 (더블클릭) | opacity-100 + ring + 엠블럼 | opacity-40 + grayscale + blur-sm |

**색상 코딩**:
- A쪽 투표 바: `bg-blue-400` (#60a5fa)
- B쪽 투표 바: `bg-pink-400` (#ec4899)
- 선택 링: `ring-red-500`
- 당첨 엠블럼: `from-pink-500 to-red-500` 그라디언트 + `animate-bounce`

---

## 8. 레이아웃 & 반응형

### 세로/가로 감지

```javascript
const mq = window.matchMedia('(orientation: portrait)');
mq.addEventListener('change', handler);
```

| 모드 | flex 방향 | 결과 |
|------|-----------|------|
| 세로 (portrait) | `flex-col` | 위/아래 분할 |
| 가로 (landscape) | `flex-row` | 좌/우 분할 |

### Z-index 레이어

| z-index | 용도 |
|---------|------|
| z-10 | VS 뱃지, 채팅피드, 네비 버튼 |
| z-20 | 안내 툴팁, 토스트 메시지 |
| z-30 | "이미 투표" 알림 |
| z-50 | 하트 애니메이션 |

---

## 9. 애니메이션 & 타이밍 상세

### CSS 애니메이션 (index.css)

| 클래스/이름 | 효과 | 시간 |
|-------------|------|------|
| `countPop` | scale 1.5→1 + fade in | 0.4s ease-out |
| `slideUp` | opacity 0 + translateY(12px) → 정상 | 0.35s ease-out |
| `blink` | opacity 1 → 0 → 1 | 0.9s step-start infinite |

### Tailwind 애니메이션

| 클래스 | 효과 |
|--------|------|
| `animate-ping` | scale + fade out 반복 (하트) |
| `animate-bounce` | 위아래 바운스 (엠블럼) |
| `animate-pulse` | opacity 진동 (참여 대기 상태) |
| `animate-blink` | index.css `blink` 연결 |

### 전체 타이밍 참조

| 이벤트 | 시간 |
|--------|------|
| 투표수 카운트 애니메이션 | 1000ms (rAF) |
| 하트 표시 | 800ms |
| 당첨 엠블럼 등장 | 2000ms (더블탭 이후) |
| 실시간 투표수 증가 인터벌 | 1000ms |
| 채팅 메시지 추가 | 1200~2000ms 랜덤 |
| "이미 투표" 알림 | 2500ms |
| Splash 자동 진행 | 8초 카운트다운 |

---

## 10. 투표수 애니메이션 알고리즘

`animateCount(target, setter, onComplete)` — App.jsx:153

```
경과시간 비율(progress) = Math.min(elapsed / 1000, 1)
eased = 1 - (1 - progress)^3  // easeOutCubic
표시값 = Math.floor(eased * target)
```

- `requestAnimationFrame` 기반 60fps 애니메이션
- easeOutCubic으로 감속 효과 (처음엔 빠르게, 끝엔 천천히)
- 완료 콜백으로 실시간 증가 인터벌 시작

---

## 11. SplashScreen 상세

- **진입**: 앱 로드 시 자동 표시
- **구조**: 3등분 레이아웃 (로고 / 카운트다운 / 결과버튼)
- **카운트다운**: 8초 자동 감소, 0이 되면 `onEnter()` 호출
- **브랜드**: "Tap" (light weight) + "Get" (black weight), 핑크 포인트 색상 `#E30B5C`
- **배경**: Unsplash 어두운 이미지 + 40% 검정 오버레이
- **결과 버튼**: `onResults()` 콜백으로 results 화면 이동

---

## 12. 결과 화면 (Results) 상세

- 전체 5개 세트의 투표 비율을 수평 바로 표시
- 8명의 당첨자 프로필 카드 (사진, 닉네임, 리뷰 텍스트, 상품명)
- 2열 그리드 레이아웃
- "홈으로" 버튼으로 main 화면 복귀
- 데이터: `WINNERS` 배열 (8개 항목, 모두 mock)

---

## 13. PWA 설정

**manifest.json**:
- `display: "standalone"` — 브라우저 UI 없이 전체화면 앱처럼 실행
- `orientation: "any"` — 세로/가로 모두 허용
- `theme_color: "#000000"` — 상태바 검정
- 아이콘: favicon.svg (maskable 포함)

**index.html**:
- `viewport-fit=cover` — 노치/Safe Area까지 채움
- `user-scalable=no` — 핀치 줌 비활성화
- `apple-mobile-web-app-capable=yes` — iOS 홈 화면 앱
- `apple-mobile-web-app-status-bar-style=black-translucent` — iOS 상태바

---

## 14. 빌드 & 배포

**vite.config.js**:
```javascript
base: '/TabGet/'  // GitHub Pages 서브디렉토리
plugins: [react(), tailwindcss()]
```

**GitHub Actions** (`.github/workflows/deploy.yml`):
1. main 브랜치 push 또는 수동 트리거
2. Node.js 20 + npm 캐시
3. `cd tabget-app && npm ci && npm run build`
4. `tabget-app/dist` → GitHub Pages 배포

---

## 15. 사용된 외부 아이콘 (Lucide React)

| 아이콘 | 사용 위치 |
|--------|-----------|
| `Heart` | 더블탭 피드백 애니메이션 |
| `Users` | 참여자 수 표시 |
| `ChevronLeft` / `ChevronRight` | 세트 이동 버튼 |
| `Trophy` | 당첨 엠블럼, 결과 버튼 |
| `Volume2` | 볼륨 아이콘 (시각만, 기능 없음) |

---

## 16. 미구현 기능 (스펙 대비 GAP)

| 스펙 기능 | 구현 상태 | 비고 |
|-----------|-----------|------|
| 스와이프 네비게이션 | 미구현 | 버튼만 있음 |
| 세트별 카운트다운 타이머 (HH:mm:ss) | 미구현 | 스플래시에 있는 단순 카운트다운만 있음 |
| 듀얼 비디오 + 볼륨 부스트 | 미구현 | 이미지만 사용, Volume2 아이콘만 표시 |
| 투표 이력 로컬 저장 | 미구현 | 새로고침 시 초기화 |
| 실제 백엔드 투표 | 미구현 | 모든 데이터 mock — § 18 자율 큐레이션 에이전트가 공급원 역할 예정 |
| Framer Motion 슬라이드 트랜지션 | 미구현 | 즉시 전환 |

---

## 17. 코드 품질 메모

- 단일 파일(`App.jsx`) 577줄에 대부분 로직 집중 — 컴포넌트 분리 필요
- `ChatFeed`만 별도 컴포넌트로 추출됨
- `App.css` (185줄)는 미사용 레거시 코드
- `useMemo`/`useCallback` 미사용 — 현재 규모에선 무방
- Tailwind 4의 `@tailwindcss/vite` 플러그인으로 빌드타임 CSS 최적화
- 이미지: 모두 Unsplash 외부 URL (로컬 에셋 없음)
- 접근성: ARIA 레이블 없음 (모바일 터치 전용 설계)

---

## 18. 백엔드 자율 큐레이션 에이전트 (설계 단계)

> 출처: `research2.md` (본 문서에 통합되며 원본은 삭제 대상).  
> TabGet 플랫폼의 핵심 엔진 — 프론트엔드가 현재 사용하는 하드코딩 `VS_DATA`를 실시간으로 대체하는 자동 생성 파이프라인이다.

### 18.1 목적 및 역할

- **고정 키워드 없는 자율 탐색**: SNS, 뉴스, 팝업스토어 동향 등 실시간 트렌드를 에이전트 스스로 수집
- **타겟팅**: 20대 여성 타겟에 최적화된 상품 대결 Poll 세트 5개를 생성
- **공급 대상**: 프론트엔드 `App.jsx`의 `VS_DATA` mock을 대체하는 PostgreSQL 기반 실시간 공급원

### 18.2 기술 스택

| 레이어 | 기술 |
|--------|------|
| Runtime | Node.js (TypeScript) |
| Agent Framework | LangChain / LangGraph (Autonomous Reasoning) |
| LLM | OpenAI GPT-4o / Gemini 1.5 Pro |
| Search Tool | Serper API (Google Search) |
| Database | PostgreSQL + Prisma ORM |
| API | Fastify (Express 대안 가능) |
| Orchestration | n8n |
| Environment | Docker Compose (WSL2) |

### 18.3 데이터 스키마 (Prisma `Poll` 모델)

| 필드 | 타입 | 비고 |
|------|------|------|
| `id` | String (uuid) | PK |
| `category` | String | 상품 카테고리 |
| `themeTitle` | String | 대결 테마 제목 |
| `productA` | Json | `{ brand, name, features, imageUrl, videoUrl }` |
| `productB` | Json | 동일 구조 |
| `curatorNote` | String? | 큐레이터 코멘트 |
| `status` | String | 기본값 `"PENDING"` (ACTIVE / ARCHIVED 등) |
| `scheduledAt` | DateTime | 노출 예정 시점 |
| `createdAt` | DateTime | 기본값 `now()` |

#### 프론트엔드 VS_DATA ↔ Poll 필드 매핑

| 프론트 (`VS_DATA`, § 4) | 백엔드 (`Poll`) |
|-------------------------|-----------------|
| `itemA` | `productA.name` |
| `itemB` | `productB.name` |
| `imgA` | `productA.imageUrl` |
| `imgB` | `productB.imageUrl` |
| (미사용) | `productA.videoUrl` → § 16 GAP "듀얼 비디오" 해결 |
| (없음) | `curatorNote` → VS 뱃지 코멘트로 노출 가능 |
| (없음) | `scheduledAt` → § 16 GAP "세트별 카운트다운" endTime 산출 |
| `votesA/B` | Poll 모델엔 없음 — 별도 `Vote` 테이블 필요 (미설계) |

### 18.4 LangGraph 에이전트 워크플로우

```
[scout] → [generate] → (curate) → END
```

**State** (`AgentState`): `{ rawTrends: string, dynamicQueries: string[], finalJson: any }`

| 노드 | 역할 | 도구 / 모델 |
|------|------|-------------|
| **Scout** | 실시간 트렌드 수집. 예시 쿼리: "오늘 한국 20대 여성 쇼핑 트렌드 및 성수동 팝업 핫이슈" | Serper API |
| **Query Generator** | 수집된 트렌드를 분석해 대결 쿼리 5개를 동적 생성 | GPT-4o (temperature 0.8) |
| **Curation** | 최종 5개 Poll 세트 JSON 정규화 → Prisma 저장 | LLM + 후처리 |

- 엔트리 포인트: `scout`
- 에지: `scout → generate → END` (research2 원본 기준, Curation 노드는 Phase 2에서 추가 예정)
- 컴파일: `workflow.compile()` → `curationAgent`
- 구현 위치 (예정): `src/agent/curator.ts`

### 18.5 API 엔드포인트

- Fastify 서버, `port 3000`, `host 0.0.0.0`
- `POST /run-curation` — `curationAgent.invoke({})` 실행 → Prisma 저장 → `{ success, data }` 응답
- 에러: HTTP 500 + `{ success: false, error }`
- 구현 위치 (예정): `src/index.ts`

### 18.6 구현 Phase

| Phase | 작업 |
|-------|------|
| **1. Environment & Schema** | Docker Compose (PostgreSQL + Node), Prisma 스키마 (`Poll`, `TrendLogs`), `.env` API 키 |
| **2. Autonomous Scout Agent** | State 정의, Scout/Query/Curation 노드, JSON 정규화 |
| **3. Persistence & API** | Prisma 저장 로직, REST API (Fastify), 이미지 URL 유효성 검증 |
| **4. Integration & Testing** | n8n 워크플로우 연동, 일일 자동 실행 스케줄러 테스트 |

### 18.7 프론트엔드와의 연결 로드맵

1. **데이터 소스 교체**: `App.jsx`의 `VS_DATA` 하드코딩 → `GET /polls?status=ACTIVE` 페치로 전환
2. **카운트다운 구현**: `scheduledAt` + 고정 duration으로 세트별 `endTime` 계산 → § 16 GAP 해결
3. **큐레이터 코멘트 노출**: `curatorNote`를 VS 뱃지 하단 또는 중앙 오버레이에 표시
4. **비디오 확장**: `productA.videoUrl`로 듀얼 비디오 + 볼륨 부스트 기능 (CLAUDE.md Core Features § 5) 활성화
5. **투표 집계**: 별도 `Vote` 모델 + `POST /polls/:id/vote` 엔드포인트가 추가로 필요 (research2 범위 밖)
