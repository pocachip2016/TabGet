# 아키텍처: TabGet

## 디렉토리 구조
```
tabget-app/          # Vite + React 앱
  src/
    App.jsx          # 메인 컴포넌트
    AdminPage.jsx    # 관리자 페이지 (#admin 해시 라우팅)
    SplashScreen.jsx
    main.jsx         # 진입점 — hash 라우팅
    api/client.js    # API 호출
    lib/visitor.js   # 방문자 ID 관리
```

## 패턴
- 해시 라우팅 (`#admin` → AdminPage)
- Portrait/Landscape 하이브리드 레이아웃 (flex-row / flex-col 전환)

## 데이터 흐름
```
사용자 더블탭 → vote API → 서버 집계 → 실시간 퍼센트 바 업데이트
```

## 외부 의존성
| 서비스 | 용도 | 비고 |
|---|---|---|
| 백엔드 API | Poll 조회·투표 | |
| Framer Motion | 슬라이드 전환 | |

## 주요 제약
- CRITICAL: `body { overflow: hidden }` 기본값 — admin 진입 시 동적으로 `overflow: auto` 전환 필수
- CRITICAL: 더블탭은 투표 1회만. 중복 투표 방지 로직 클라이언트 측 필요
