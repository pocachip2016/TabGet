# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
cd tabget-app
npm run dev      # 개발 서버 (localhost:5173)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

## Project Structure

```
tabget-app/          # Vite + React 앱
  src/
    App.jsx          # 메인 컴포넌트 (전체 앱 로직)
    AdminPage.jsx    # 관리자 페이지 (#admin 해시로 진입)
    SplashScreen.jsx # 스플래시 화면
    main.jsx         # React 진입점 — hash 라우팅 (#admin → AdminPage)
    index.css        # Tailwind 4 + 글로벌 스타일
    api/client.js    # API 호출 함수
    lib/visitor.js   # 방문자 ID 관리
  vite.config.js     # @tailwindcss/vite 플러그인 설정
```

## Project Overview

TabGet is a mobile-first product comparison voting app. Users see two products side-by-side and vote by double-tapping. Up to 5 comparison sets roll in sequence, each with a countdown timer.

## Core Features (from spec)

1. **Real-time visual feedback** — voted side gets opacity-100 + saturation boost + border highlight; non-voted side gets opacity-30 + blur(4px) + grayscale. Pre-vote: both sides at opacity-100.

2. **Swipe navigation (mobile)** — `onTouchStart`/`onTouchEnd` with `deltaX` threshold: left swipe → `nextSet()`, right swipe → `prevSet()`. Use Framer Motion for slide transitions.

3. **Hybrid responsive layout** — Portrait mode: left/right split (`flex-row`). Landscape mode: top/bottom split (`flex-col`). Detect via `window.onresize` or `matchMedia`, stored as `isPortrait` state.

4. **Countdown timer** — per-set `endTime` timestamp, `setInterval` updates every second. Format: `HH : mm : ss`. At 0: block voting and auto-display Winner emblem.

5. **Interaction details**
   - Double-tap to vote → heart animation + haptic feedback (`navigator.vibrate`)
   - Center overlay: live participant count + vote percentage bar
   - Max 5 sets in rolling structure
   - Dual-video audio: boost volume on the side the user last touched/focused

## Admin Page (`#admin`)

`localhost:5173/TabGet/#admin` 으로 접근. `main.jsx`에서 hash 라우팅으로 분기.

- **스크롤**: `body { overflow: hidden }` 이 기본값이므로 `main.jsx`에서 `#admin` 진입 시 `document.body.style.overflow = 'auto'` 로 동적 전환, 이탈 시 복원.
- **에이전트 실행 기록**: 가로 스크롤 칩 바 (`RunChips` 컴포넌트). 각 칩은 `#번호` + 실행 시각 표시. 클릭하면 아래 Poll 목록이 해당 실행 기준으로 필터링됨. `전체` 칩으로 필터 해제.
- **Poll 목록**: 2열 그리드. 상태 필터(ALL / PENDING / ACTIVE / ARCHIVED) + 페이지네이션. 선택된 실행이 있으면 헤더에 날짜·시각 배지 표시.
- **액션 버튼**: `ACTIVE 전환` (PENDING → ACTIVE 일괄), `에이전트 실행` (큐레이션 에이전트 트리거).
