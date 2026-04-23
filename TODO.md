# TabGet — 3기능 구현 TODO

**브랜치**: `feature/upgrade`  
**상세 계획**: `/home/ktalpha/.claude_acc2/plans/hazy-wandering-clover.md`

> **세션 재개 프롬프트**: "TODO.md 확인하고 다음 단계부터 이어서 진행해"

---

## Phase 1 — 슬라이드쇼 백엔드 (의존성 없음, 리스크 최저)
- [x] **1.1** `backend/src/agent/state.ts`: `ProductPayload`에 `gallery?: string[]` 추가
- [x] **1.2** `backend/src/agent/nodes/curate.ts`: `findImages(query, max=5)` 신설 + URL 베이스 dedup + 호스트 분산 (3개 초과 제한)
- [x] **1.3** `buildDraft` 양쪽 분기(LLM·폴백)를 `{ imageUrl, gallery }` 구조로 수정
- [x] **1.4** 빌드 확인: `cd backend && npm run build`
- [ ] **1.5** `POST /run-curation` 호출 → `GET /admin/polls` 응답에 `productA.gallery`가 2장+ 확인

## Phase 2 — 슬라이드쇼 프론트엔드
- [ ] **2.1** `tabget-app/src/index.css`에 Ken Burns 키프레임 + `prefers-reduced-motion` 가드 추가
- [ ] **2.2** `tabget-app/src/components/ProductSlideshow.jsx` 신규 (프리로드, 에러 내성, 가시성 가드, Ken Burns)
- [ ] **2.3** `App.jsx` `normalizePoll` 확장 (`galleryA/B`, `videoA/B`)
- [ ] **2.4** `App.jsx:582`, `:635` `<img>` → `<ProductSlideshow>` 교체
- [ ] **2.5** `npm run dev` 구동, 슬라이드 전환/반대편 선택 시 정지/단일이미지/플레이스홀더 확인
- [ ] **2.6** `prefers-reduced-motion` 환경에서 Ken Burns 비활성 확인

## Phase 3 — TV 모드
- [ ] **3.1** `tabget-app/src/ViewModeContext.jsx` 신규 (Provider + 훅 + localStorage 동기화 + 폴백)
- [ ] **3.2** `tabget-app/src/components/ViewModeToggle.jsx` 신규 (`[📱 Phone | 📺 TV]` 필 토글, size prop)
- [ ] **3.3** `tabget-app/src/main.jsx`에서 `<ViewModeProvider>` 래핑 (App + AdminPage 모두)
- [ ] **3.4** `App.jsx:569` 프레임 조건부 전환 — Phone `w-[667px] h-[375px] rounded-[40px] border-[8px]` / TV `w-[1280px] h-[720px] border-[20px] border-zinc-900` + 스탠드 + LED
- [ ] **3.5** App.jsx 내 `sz(phone, tv)` 헬퍼 도입, 주요 지점 10개 교체 (상품명/참여자/퍼센트/VS배지/바두께/오버레이/토스트)
- [ ] **3.6** TV 모드 키보드 훅 (ArrowLeft/Right/Enter/Space), 입력 박스 포커스 시 가로채기 금지
- [ ] **3.7** 토글 버튼 3곳 배치 (Splash, Main 네비 `bottom-3 right-3`, Results 상단 우측)
- [ ] **3.8** Chrome DevTools 1920×1080 에서 수동 테스트, 새로고침 후 localStorage 상태 유지 확인

## Phase 4 — 배틀 챗봇 스키마·라우트
- [ ] **4.1** `backend/prisma/schema.prisma`에 `Message` 모델 + `Poll.messages` 관계 추가
- [ ] **4.2** `npx prisma migrate dev --name add_message` 실행, 생성 SQL 검토
- [ ] **4.3** `backend/src/battle/generate.ts` 스캐폴드 (페르소나 상수, 이름 풀, 화자/페르소나 선택 로직 — LLM 미포함)
- [ ] **4.4** `backend/src/index.ts`에 `GET /polls/:id/messages` 라우트 추가
- [ ] **4.5** `backend/src/index.ts`에 `POST /polls/:id/battle/tick` 라우트 추가 (mock 메시지 반환)
- [ ] **4.6** curl로 두 라우트 응답 확인

## Phase 5 — 배틀 생성기 LLM 연결 + cron
- [ ] **5.1** `generate.ts`에 `rateLimitedInvoke(createLLM(0.9), ...)` + JSON 파싱 + 1회 재시도 (temperature 1.0)
- [ ] **5.2** 가드: 시간당 40개 하드캡, 2초 쿨타임, ARCHIVED 체크, 00시 스킵
- [ ] **5.3** `backend/src/index.ts`에 배틀 cron 등록 (30초, `BATTLE_ENABLED=true` 게이트)
- [ ] **5.4** `.env.example` 갱신, `ecosystem.config.cjs`에 `BATTLE_ENABLED` 노트
- [ ] **5.5** `BATTLE_ENABLED=true`로 로컬 실행, 60초 후 `GET /polls/:id/messages` 새 메시지 확인
- [ ] **5.6** 페르소나 다양성·authorName 베리에이션·JSON 파싱 실패 재시도 확인

## Phase 6 — 배틀 프론트 통합
- [ ] **6.1** `tabget-app/src/api/client.js`에 `fetchMessages`, `triggerBattleTick` 추가
- [ ] **6.2** `tabget-app/src/components/BattleFeed.jsx` 신규 (5초 폴링, 가시성 가드, pollId 변경 정리, 슬라이드 인/아웃, TV 스케일)
- [ ] **6.3** `App.jsx` 70~143행 `CHAT_MESSAGES`/`NICKNAMES`/`ChatFeed` 삭제
- [ ] **6.4** 617, 670행 `<ChatFeed>` 제거 → VS 배지 근처에 `<BattleFeed pollId={currentSet.id} />` 단일 배치
- [ ] **6.5** `submitVote` 성공 후 `triggerBattleTick(pollId).catch(()=>{})` 추가
- [ ] **6.6** 브라우저에서 투표 직후 즉각 새 메시지 추가 확인

## Phase 7 — 통합 QA + 문서화
- [ ] **7.1** Phone 모드: 슬라이드쇼 + 투표 흐름 + 배틀 피드 실시간 + 토스트
- [ ] **7.2** TV 모드: 1280×720 프레임 + 스탠드 + LED + 대형 텍스트 + 키보드 네비
- [ ] **7.3** AdminPage 회귀 (`#admin` 기존 동작 정상)
- [ ] **7.4** `BATTLE_ENABLED=false` 재시작 → 새 메시지 생성 중단 확인
- [ ] **7.5** Gemini 키 없는 환경 → 배틀 cron 조용히 비활성, 앱 정상 동작
- [ ] **7.6** `CLAUDE.md` 갱신 (환경변수, localStorage 키, gallery 계약)
- [ ] **7.7** 최종 PM2 재시작 + 스모크 테스트

---

## 핵심 설계 결정 (변경 불필요)

| 항목 | 결정 |
|------|------|
| 동영상 소스 | 이미지 슬라이드쇼 (Ken Burns). `videoUrl`은 수동 입력 예외 경로 |
| TV 진입 | 화면 내 토글 버튼 + localStorage `tabget:viewMode` |
| TV 프레임 | 1280×720 고정 + 두꺼운 베젤 + 스탠드 + 전원 LED |
| 채팅 구성 | 봇 전용 배틀 피드 (유저 입력 불가) |
| 페르소나 가중치 | COMPETE 0.4 / CHECK 0.3 / COVET 0.3 |
| authorName | 팀별명형 + 브랜드별명형 50/50 혼용 |
| 배틀 트리거 | 서버 cron 30초 (`BATTLE_ENABLED=true` 게이트) |
| AdminPage | TV 모드 영향 없음. 현행 레이아웃 유지 |
