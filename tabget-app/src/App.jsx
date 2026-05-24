import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Heart, Users, Trophy } from 'lucide-react';
import SplashScreen from './SplashScreen';
import ProductSlideshow from './components/ProductSlideshow';
import ViewModeToggle from './components/ViewModeToggle';
import ResultCard from './components/ResultCard';
import { useViewMode } from './ViewModeContext';
import { fetchPolls, submitVote, ApiError } from './api/client';
import BattleFeed from './components/BattleFeed';
import { getVisitorId } from './lib/visitor';
import { WINNERS } from './mock/winnersData';
import './index.css';

function normalizePoll(p) {
  const a = p.productA ?? {};
  const b = p.productB ?? {};
  return {
    id: p.id,
    itemA: a.name ?? '',
    itemB: b.name ?? '',
    imgA: a.imageUrl ?? '',
    imgB: b.imageUrl ?? '',
    galleryA: Array.isArray(a.gallery) ? a.gallery : [],
    galleryB: Array.isArray(b.gallery) ? b.gallery : [],
    videoA: a.videoUrl ?? '',
    videoB: b.videoUrl ?? '',
    votesA: p.votesA ?? 0,
    votesB: p.votesB ?? 0,
    messages: Array.isArray(p.messages) ? p.messages : [],
  };
}

const VS_DATA = [
  {
    id: 1,
    itemA: "프리미엄 무선 이어폰",
    itemB: "최신형 스마트워치",
    imgA: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800",
    votesA: 12450,
    votesB: 11820,
  },
  {
    id: 2,
    itemA: "화이트 스니커즈",
    itemB: "어글리 슈즈",
    imgA: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800",
    votesA: 8900,
    votesB: 9200,
  },
  {
    id: 3,
    itemA: "아이스 아메리카노",
    itemB: "따뜻한 카페라떼",
    imgA: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=800",
    votesA: 15600,
    votesB: 14200,
  },
  {
    id: 4,
    itemA: "고성능 게이밍 폰",
    itemB: "휴대용 게임 콘솔",
    imgA: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?auto=format&fit=crop&q=80&w=800",
    votesA: 7800,
    votesB: 8500,
  },
  {
    id: 5,
    itemA: "소니 WH-1000XM5",
    itemB: "애플 AirPods Max",
    imgA: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&q=80&w=800",
    votesA: 13800,
    votesB: 12200,
  },
];


export default function App() {
  const [screen, setScreen] = useState('splash'); // 'splash' | 'main' | 'results'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSide, setSelectedSide] = useState(null);
  const [votedSide, setVotedSide] = useState(null);
  const [showHeart, setShowHeart] = useState({ active: false, x: 0, y: 0 });
  const [isWinnerRevealed, setIsWinnerRevealed] = useState(false);
  const [showAlreadyVoted, setShowAlreadyVoted] = useState(false);
  const alreadyVotedTimerRef = useRef(null);
  const [displayVotesA, setDisplayVotesA] = useState(0);
  const [displayVotesB, setDisplayVotesB] = useState(0);
  const heartTimeoutRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const animFrameRef = useRef(null);
  const frameRef = useRef(null);
  const voteCastRef = useRef(false); // 이번 세션에 투표 발생 여부
  const allDoneProcessedRef = useRef(false); // "모두 응모" 전환 완료 여부

  const [polls, setPolls] = useState([]);
  const [votedPollIds, setVotedPollIds] = useState([]);
  const [votedSides, setVotedSides] = useState({}); // { [pollId]: 'A' | 'B' }
  const [showAllDone, setShowAllDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const [buyDialog, setBuyDialog] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const toastTimerRef = useRef(null);
  const hintTimersRef = useRef({ show: null, hide: null });
  const visitorIdRef = useRef(null);

  const { mode, orientation } = useViewMode();
  const sz = (phone, tv) => mode === 'tv' ? tv : phone;
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  const isPortrait = orientation === 'portrait' ? true : orientation === 'landscape' ? false : vw <= vh;
  const isMobile = mode !== 'tv' && vw <= 640;
  const tvScale = mode === 'tv' ? Math.min(1, vw / 1360, vh / 820) * 0.9 : 1;
  if (visitorIdRef.current === null) {
    visitorIdRef.current = getVisitorId();
  }

  const showToast = (message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    fetchPolls(visitorIdRef.current)
      .then((data) => {
        if (cancelled) return;
        setPolls((data.polls ?? []).map(normalizePoll));
        setVotedPollIds(data.votedPollIds ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // viewport 크기 추적 (orientation + tvScale 포함)
  useEffect(() => {
    const handler = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // TV 키보드 네비게이션
  useEffect(() => {
    if (mode !== 'tv') return;
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Enter') { e.preventDefault(); handleClick(selectedSide ?? 'A'); }
      else if (e.key === ' ') { e.preventDefault(); if (selectedSide) handleDoubleClick(selectedSide, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, selectedSide]);

  const currentSet = polls[currentIndex];
  const hasCurrentVoted = currentSet ? votedPollIds.includes(currentSet.id) : false;

  // 표시용 기본 인구 (500~1000) — 실제 투표수에 더해져 표시됨 (poll당 결정론적)
  const fakePeak = useMemo(() => {
    if (!currentSet) return { a: 700, b: 750 };
    const h = Math.abs(currentSet.id.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0));
    return { a: 500 + (h % 501), b: 500 + ((h >> 4) % 501) };
  }, [currentSet?.id]);
  const totalDisplay = displayVotesA + displayVotesB;
  const pctA = totalDisplay > 0 ? Math.round((displayVotesA / totalDisplay) * 100) : 50;
  const pctB = totalDisplay > 0 ? 100 - pctA : 50;

  // 선택 시: 0 → 목표값 카운트업 애니메이션
  const animateCount = (target, setter, onComplete) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const duration = 1000 + Math.random() * 1000; // 1~2초
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setter(Math.floor(eased * target));
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setter(target);
        onComplete?.();
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  // 단일 클릭: 상품 선택
  const handleClick = (side) => {
    if (!currentSet) return;
    if (selectedSide === side) return;

    if (hasCurrentVoted) {
      if (alreadyVotedTimerRef.current) clearTimeout(alreadyVotedTimerRef.current);
      setShowAlreadyVoted(true);
      alreadyVotedTimerRef.current = setTimeout(() => setShowAlreadyVoted(false), 2500);
      return;
    }

    // 이미 응모한 세트에서 다른 상품 클릭 시 안내 메시지
    if (votedSide && side !== votedSide) {
      if (alreadyVotedTimerRef.current) clearTimeout(alreadyVotedTimerRef.current);
      setShowAlreadyVoted(true);
      alreadyVotedTimerRef.current = setTimeout(() => setShowAlreadyVoted(false), 2500);
      return;
    }

    setSelectedSide(side);

    // 기존 인터벌 정리
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);

    const targetA = (currentSet.votesA || 0) + fakePeak.a;
    const targetB = (currentSet.votesB || 0) + fakePeak.b;

    if (side === 'A') {
      setDisplayVotesB(targetB); // 반대쪽은 고정
      setDisplayVotesA(0);
      animateCount(targetA, setDisplayVotesA, () => {
        // 카운트업 완료 후 실시간 증가
        liveIntervalRef.current = setInterval(() => {
          setDisplayVotesA((v) => v + Math.floor(Math.random() * 5) + 1);
        }, 1000);
      });
    } else {
      setDisplayVotesA(targetA); // 반대쪽은 고정
      setDisplayVotesB(0);
      animateCount(targetB, setDisplayVotesB, () => {
        liveIntervalRef.current = setInterval(() => {
          setDisplayVotesB((v) => v + Math.floor(Math.random() * 5) + 1);
        }, 1000);
      });
    }
  };

  // 세트 변경 시 투표수·투표 상태 복원
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    const p = polls[currentIndex];
    if (!p) return;

    const h = Math.abs(p.id.split('').reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 0));
    setDisplayVotesA((p.votesA || 0) + 500 + (h % 501));
    setDisplayVotesB((p.votesB || 0) + 500 + ((h >> 4) % 501));
    const prevSide = votedSides[p.id] ?? null;
    setVotedSide(prevSide);
    setSelectedSide(prevSide);
    setIsWinnerRevealed(!!prevSide);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, polls.length]);

  // 힌트 표시 타이머 — 진입 후 3초 무반응이면 5초간 표시, 사용자 인터랙션 시 즉시 숨김
  useEffect(() => {
    const t = hintTimersRef.current;
    if (t.show) clearTimeout(t.show);
    if (t.hide) clearTimeout(t.hide);
    setShowHint(false);

    if (selectedSide || votedSide || isWinnerRevealed) return;

    t.show = setTimeout(() => {
      setShowHint(true);
      t.hide = setTimeout(() => setShowHint(false), 10000);
    }, 3000);

    return () => {
      if (t.show) clearTimeout(t.show);
      if (t.hide) clearTimeout(t.hide);
    };
  }, [currentIndex, selectedSide, votedSide, isWinnerRevealed]);

  // 모든 세트 응모 완료 감지 (이번 세션에 투표가 1번 이상 발생한 경우만)
  useEffect(() => {
    if (!voteCastRef.current) return;
    if (polls.length === 0) return;
    if (allDoneProcessedRef.current) return;
    if (!polls.every((p) => votedPollIds.includes(p.id))) return;

    allDoneProcessedRef.current = true;
    const t1 = setTimeout(() => {
      setShowAllDone(true);
      const t2 = setTimeout(() => {
        setShowAllDone(false);
        setScreen('splash');
      }, 4000);
      return () => clearTimeout(t2);
    }, 2500);
  }, [polls.length, votedPollIds.length]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 더블클릭: 이벤트 참여 (하트 + 위너 공개)
  const handleDoubleClick = async (side, e) => {
    if (!currentSet) return;
    if (votedPollIds.includes(currentSet.id) || votedSide) {
      if (alreadyVotedTimerRef.current) clearTimeout(alreadyVotedTimerRef.current);
      setShowAlreadyVoted(true);
      alreadyVotedTimerRef.current = setTimeout(() => setShowAlreadyVoted(false), 2500);
      return;
    }

    // Optimistic UI
    setVotedSide(side);
    setSelectedSide(side);
    if (side === 'A') setDisplayVotesA((v) => v + 1);
    else setDisplayVotesB((v) => v + 1);

    const rect = frameRef.current?.getBoundingClientRect();
    const hx = rect ? e.clientX - rect.left : e.clientX;
    const hy = rect ? e.clientY - rect.top : e.clientY;
    setShowHeart({ active: true, x: hx, y: hy });
    if (heartTimeoutRef.current) clearTimeout(heartTimeoutRef.current);
    heartTimeoutRef.current = setTimeout(
      () => setShowHeart((h) => ({ ...h, active: false })),
      800
    );

    if (navigator.vibrate) navigator.vibrate(80);

    const pollId = currentSet.id;
    try {
      await submitVote(pollId, side, visitorIdRef.current);
      setVotedPollIds((ids) => (ids.includes(pollId) ? ids : [...ids, pollId]));
      setVotedSides((s) => ({ ...s, [pollId]: side }));
      voteCastRef.current = true;
      setIsWinnerRevealed(true);

      // Auto-advance: 응모완료 표시 후 다음 미응모 poll로 이동
      const newVotedIds = votedPollIds.includes(pollId) ? votedPollIds : [...votedPollIds, pollId];
      const allDone = polls.every((p) => newVotedIds.includes(p.id));
      if (!allDone) {
        setTimeout(() => {
          const total = polls.length;
          for (let i = 1; i <= total; i++) {
            const idx = (currentIndex + i) % total;
            if (!newVotedIds.includes(polls[idx].id)) {
              resetSet();
              setCurrentIndex(idx);
              return;
            }
          }
        }, 1500);
      }
      // 전부 응모 완료 시: useEffect (line 262)이 showAllDone + results 전환 처리
    } catch (err) {
      // Rollback optimistic counter
      if (side === 'A') setDisplayVotesA((v) => Math.max(0, v - 1));
      else setDisplayVotesB((v) => Math.max(0, v - 1));

      if (err instanceof ApiError && err.code === 'already_voted') {
        setVotedPollIds((ids) => (ids.includes(pollId) ? ids : [...ids, pollId]));
        setIsWinnerRevealed(true);
      } else if (err instanceof ApiError && err.code === 'voting_closed') {
        setVotedSide(null);
        setSelectedSide(null);
        showToast('투표 마감 시간입니다 (00시~01시)');
      } else {
        setVotedSide(null);
        setSelectedSide(null);
        showToast('투표 전송 실패. 잠시 후 다시 시도해주세요');
      }
    }
  };

  const resetSet = () => {
    // votedSide/isWinnerRevealed는 currentIndex useEffect에서 복원
    setShowAlreadyVoted(false);
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (alreadyVotedTimerRef.current) clearTimeout(alreadyVotedTimerRef.current);
  };

  if (screen === 'splash') {
    return (
      <SplashScreen
        onEnter={() => setScreen('main')}
        onResults={() => setScreen('results')}
        isExhausted={polls.length > 0 && polls.every((p) => votedPollIds.includes(p.id))}
      />
    );
  }

  if (screen === 'results') {
    const isTV = mode === 'tv';
    const BuyDialog = ({ product, onClose }) => {
      const KT_LOGO = 'https://api.brandb.net/api/v2/common/image?fileId=2887';
      const BRAND = '#E30B5C';
      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose}>
          <div
            className={`rounded-3xl overflow-hidden flex flex-col ${isTV ? 'w-[420px]' : isPortrait ? 'w-[220px]' : 'w-[190px]'}`}
            style={{
              background: 'rgba(18,18,24,0.72)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 포스터 */}
            <div className={`relative w-full ${isTV ? 'h-[260px]' : isPortrait ? 'h-[140px]' : 'h-[90px]'} shrink-0`}>
              <img src={product.imgUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(18,18,24,0.95) 0%, rgba(18,18,24,0.1) 60%)' }} />
              <p className={`absolute bottom-3 left-4 right-4 text-white font-black ${sz('text-sm', 'text-xl')} leading-tight drop-shadow-lg`}>
                {product.name}
              </p>
              <span
                className={`absolute top-3 right-3 ${sz('text-[10px] px-1.5 py-0.5', 'text-sm px-2.5 py-1')} rounded-full font-black text-white shadow`}
                style={{ background: `linear-gradient(135deg, ${BRAND}, #c4084e)` }}
              >
                -{product.discountPct}%
              </span>
            </div>

            {/* 본문 */}
            <div className={`flex flex-col items-center ${isTV ? 'px-8 py-6 gap-4' : isPortrait ? 'px-5 py-4 gap-3' : 'px-3 py-2 gap-2'}`}>
              <div className="w-full h-px bg-white/15" />

              {/* kt알파쇼핑 로고 */}
              <img src={KT_LOGO} alt="kt알파쇼핑" className={`${sz('h-5', 'h-8')} object-contain opacity-80`}
                style={{ mixBlendMode: 'screen' }}
                onError={(e) => { e.target.style.display = 'none'; }} />

              <p className={`text-white/55 ${sz('text-[10px]', 'text-base')} tracking-wide`}>으로 이동합니다</p>

              <div className="w-full h-px bg-white/15" />

              {/* 닫기 버튼 */}
              <button
                onClick={onClose}
                className="group relative overflow-hidden rounded-2xl transition-all duration-200 active:scale-95 w-full"
              >
                <div
                  className="absolute -inset-0.5 rounded-2xl blur-sm opacity-60 group-hover:opacity-90 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, #ff4d88)` }}
                />
                <div
                  className={`relative ${sz('py-2.5 text-xs', 'py-4 text-lg')} rounded-2xl text-white font-bold tracking-wide text-center`}
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #c4084e 100%)` }}
                >
                  닫기
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className={isMobile ? 'fixed inset-0 bg-zinc-950' : 'flex items-center justify-center min-h-screen bg-white'}>
        {!isMobile && (
          <div className="fixed top-4 left-4 z-50">
            <ViewModeToggle size="lg" />
          </div>
        )}
        <div
          className="flex flex-col items-center"
          style={isTV ? { transform: `translateY(40px) scale(${tvScale})`, transformOrigin: 'top center' } : {}}
        >
          <div
            className={
              isMobile
                ? 'relative overflow-hidden bg-zinc-950'
                : isTV
                  ? 'relative w-[1280px] h-[720px] rounded-xl border-[20px] border-zinc-800 shadow-2xl overflow-hidden bg-zinc-950'
                  : isPortrait
                    ? 'relative w-[300px] h-[534px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl overflow-hidden bg-zinc-950'
                    : 'relative w-[534px] h-[300px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl overflow-hidden bg-zinc-950'
            }
            style={isMobile ? { width: vw, height: vh } : {}}
          >
            {/* 구매 다이얼로그 */}
            {buyDialog && <BuyDialog product={buyDialog} onClose={() => setBuyDialog(null)} />}

            {/* 헤더 */}
            <div className={`flex flex-col items-center border-b border-white/10 shrink-0 ${isTV ? 'pt-5 pb-3' : isPortrait ? 'pt-5 pb-3' : 'pt-2 pb-2'}`}>
              <h2 className={`${isTV ? 'text-4xl' : isPortrait ? 'text-xl' : 'text-base'} font-black`}>
                <span className="text-white">Tap</span>
                <span style={{ color: '#E30B5C' }}>Get</span>
                <span className={`text-white/40 ${isTV ? 'text-xl' : 'text-sm'} font-normal ml-2`}>당첨결과</span>
              </h2>
            </div>

            {/* 카드 그리드 스크롤 영역 */}
            <div className="h-full overflow-y-auto pb-16" style={{ scrollbarWidth: 'none' }}>
              <div className={`${isTV ? 'px-5 pt-4' : 'px-3 pt-3'} grid ${isTV || !isPortrait ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                {WINNERS.map((winner) => (
                  <ResultCard key={winner.round} winner={winner} isTV={isTV} onBuyClick={setBuyDialog} />
                ))}
              </div>
              <div className="h-16" />
            </div>

            {/* 메인으로 버튼 - 하단 고정 */}
            <div className={`absolute bottom-0 left-0 right-0 flex justify-center ${isPortrait || isTV ? 'pb-10 pt-6' : 'pb-4 pt-3'} bg-gradient-to-t from-zinc-950 to-transparent`}>
              <button
                onClick={() => setScreen('splash')}
                className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="absolute -inset-1 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #E30B5C, #ff6b9d)' }} />
                <div className={`relative flex items-center gap-3 ${sz('px-8 py-4', 'px-12 py-5')} rounded-2xl shadow-xl`}
                  style={{ background: 'linear-gradient(135deg, #E30B5C 0%, #c4084e 100%)' }}>
                  <div className={`${sz('w-9 h-9', 'w-12 h-12')} rounded-full bg-white/15 flex items-center justify-center flex-shrink-0`}>
                    <svg width={sz(18, 24)} height={sz(18, 24)} viewBox="0 0 24 24" fill="none">
                      <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className={`${sz('text-[9px]', 'text-sm')} text-white/60 font-semibold tracking-widest uppercase`}>Home</span>
                    <span className={`${sz('text-sm', 'text-xl')} font-black text-white tracking-tight`}>메인으로</span>
                  </div>
                  <div className={`${sz('w-7 h-7', 'w-10 h-10')} rounded-full bg-white/15 flex items-center justify-center ml-1`}>
                    <svg width={sz(12, 16)} height={sz(12, 16)} viewBox="0 0 12 12" fill="none">
                      <path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
          {isTV && (
            <div className="flex flex-col items-center">
              <div className="w-[180px] h-[40px] bg-gradient-to-b from-zinc-700 to-zinc-900" style={{ clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)' }} />
              <div className="w-[480px] h-[14px] rounded-b-xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-xl" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-[534px] h-[300px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl flex items-center justify-center text-white/70 text-sm bg-zinc-950">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-[534px] h-[300px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-3 bg-zinc-950 text-white px-10 text-center">
          <p className="text-sm text-red-400">데이터를 불러오지 못했습니다</p>
          <p className="text-xs text-white/50">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!currentSet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-[534px] h-[300px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl flex items-center justify-center text-white/60 text-sm bg-zinc-950">
          표시할 투표가 없습니다
        </div>
      </div>
    );
  }

  const handleDebugReset = () => {
    localStorage.removeItem('tabget:visitorId');
    visitorIdRef.current = getVisitorId();
    setPolls([]);
    setVotedPollIds([]);
    setCurrentIndex(0);
    resetSet();
    setIsLoading(true);
    setLoadError(null);
    fetchPolls(visitorIdRef.current)
      .then((data) => {
        setPolls((data.polls ?? []).map(normalizePoll));
        setVotedPollIds(data.votedPollIds ?? []);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  };

  return (
    <div className={isMobile ? 'fixed inset-0 bg-black font-sans' : 'flex flex-col items-center justify-center min-h-screen bg-white font-sans'}>
      {!isMobile && (
        <div className="fixed top-4 left-4 z-50">
          <ViewModeToggle size="lg" />
        </div>
      )}
      <div
        className="flex flex-col items-center"
        style={mode === 'tv' ? { transform: `translateY(40px) scale(${tvScale})`, transformOrigin: 'top center' } : {}}
      >
      <div ref={frameRef}
        className={
          isMobile
            ? 'relative overflow-hidden'
            : mode === 'tv'
              ? 'relative w-[1280px] h-[720px] border-[20px] border-zinc-800 rounded-xl shadow-2xl overflow-hidden'
              : isPortrait
                ? 'relative w-[300px] h-[534px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl overflow-hidden'
                : 'relative w-[534px] h-[300px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl overflow-hidden'
        }
        style={isMobile ? { width: vw, height: vh } : {}}
      >
        {showAllDone && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
               style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}>
            <div className={`${sz('text-3xl', 'text-7xl')} mb-3 animate-bounce`}>🎉</div>
            <p className={`text-white ${sz('text-xs', 'text-2xl')} font-black text-center leading-snug px-6`}>
              오늘은 다 참여하셨습니다.<br />두둥~~
            </p>
            <p className={`text-white/70 ${sz('text-[10px]', 'text-base')} mt-2 font-medium`}>24:30분에 발표합니다.</p>
            <p className={`text-white/40 ${sz('text-[9px]', 'text-sm')} mt-4 animate-pulse`}>결과 페이지로 이동 중...</p>
          </div>
        )}
        {showHint && (
          <div className={`animate-fade-in-down absolute ${sz(isPortrait ? 'top-[48%]' : 'top-3', 'top-8')} left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md ${sz('px-3 py-1.5', 'px-8 py-3')} rounded-full border border-white/20 ${sz('text-[9px]', 'text-xl')} font-medium z-30 whitespace-nowrap pointer-events-none`}>
            <span className="text-yellow-200 font-bold">클릭</span><span className="text-white font-bold">(선택)</span>
            <span className="mx-1.5"> </span>
            <span className="text-yellow-400 font-bold">더블클릭</span><span className="text-white font-bold">(이벤트참여)</span>
          </div>
        )}
        <div className={`flex w-full h-full ${isPortrait && mode !== 'tv' ? 'flex-col' : 'flex-row'}`}>

          {/* Section A */}
          <div
            style={{ transform: 'translateZ(0)' }}
            className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer
              ${isWinnerRevealed && votedSide === 'B' ? 'opacity-40 grayscale blur-sm'
                : selectedSide === 'A' ? 'opacity-100 brightness-105'
                : selectedSide === 'B' ? 'opacity-55'
                : 'opacity-100'}`}
            onClick={() => handleClick('A')}
            onDoubleClick={(e) => handleDoubleClick('A', e)}
          >
            <ProductSlideshow
              images={[currentSet.imgA, ...currentSet.galleryA].filter(Boolean)}
              videoUrl={currentSet.videoA}
              paused={selectedSide === 'B' || isWinnerRevealed}
              animDuration={3500}
              animDelay={0}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            <div className={`absolute ${sz('bottom-20', 'bottom-48')} ${mode === 'tv' ? 'left-2 right-2' : 'left-2 w-[45%]'} z-10`}>
              <BattleFeed side="A" initialMessages={currentSet?.messages ?? []} />
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <h3
                className={`${sz('text-sm', 'text-5xl')} font-black tracking-tight text-white`}
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.5)' }}
              >
                {currentSet.itemA}
              </h3>
              <div className={`flex items-center gap-1.5 mt-1 ${sz('text-[11px]', 'text-2xl')} text-white/80`}>
                <Users size={sz(11, 32)} />
                <span>{displayVotesA.toLocaleString()}명 참여 중</span>
              </div>
              <div className={`mt-1.5 ${sz('h-1.5', 'h-3')} rounded-full bg-white/20 overflow-hidden`}>
                <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${pctA}%` }} />
              </div>
              <p className={`${sz('text-[9px]', 'text-xl')} text-white/60 mt-0.5`}>{pctA}%</p>
            </div>

            {isWinnerRevealed && votedSide === 'A' && (
              <div className={`absolute inset-x-0 ${sz('top-6', 'top-16')} flex justify-center pointer-events-none z-20`}>
                <div className={`backdrop-blur-xl bg-black/40 border border-white/20 text-white ${sz('px-6 py-2.5', 'px-14 py-5')} rounded-full ${sz('text-[11px]', 'text-2xl')} font-medium tracking-[0.08em] flex items-center ${sz('gap-2', 'gap-4')} shadow-2xl animate-fade-in-down`}>
                  <Trophy size={sz(14, 32)} className="text-pink-400" strokeWidth={2.25} />
                  <span>응모완료</span>
                </div>
              </div>
            )}

          </div>

          {/* VS 중앙 */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
            <div className={`${sz('w-9 h-9 text-xs', 'w-24 h-24 text-3xl')} rounded-full bg-white text-black font-black flex items-center justify-center shadow-xl`}>
              VS
            </div>
          </div>

          {/* Section B */}
          <div
            style={{ transform: 'translateZ(0)' }}
            className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer
              ${isWinnerRevealed && votedSide === 'A' ? 'opacity-40 grayscale blur-sm'
                : selectedSide === 'B' ? 'opacity-100 brightness-105'
                : selectedSide === 'A' ? 'opacity-55'
                : 'opacity-100'}`}
            onClick={() => handleClick('B')}
            onDoubleClick={(e) => handleDoubleClick('B', e)}
          >
            <ProductSlideshow
              images={[currentSet.imgB, ...currentSet.galleryB].filter(Boolean)}
              videoUrl={currentSet.videoB}
              paused={selectedSide === 'A' || isWinnerRevealed}
              animDuration={4700}
              animDelay={-2100}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            <div className={`absolute ${sz('bottom-20', 'bottom-48')} ${mode === 'tv' ? 'left-2 right-2' : 'right-2 w-[45%]'} z-10`}>
              <BattleFeed side="B" initialMessages={currentSet?.messages ?? []} />
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <h3
                className={`${sz('text-sm', 'text-5xl')} font-black tracking-tight text-white text-right`}
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.5)' }}
              >
                {currentSet.itemB}
              </h3>
              <div className={`flex items-center justify-end gap-1.5 mt-1 ${sz('text-[11px]', 'text-2xl')} text-white/80`}>
                <Users size={sz(11, 32)} />
                <span>{displayVotesB.toLocaleString()}명 참여 중</span>
              </div>
              <div className={`mt-1.5 ${sz('h-1.5', 'h-3')} rounded-full bg-white/20 overflow-hidden`}>
                <div className="h-full bg-pink-400 rounded-full transition-all duration-300" style={{ width: `${pctB}%` }} />
              </div>
              <p className={`${sz('text-[9px]', 'text-xl')} text-white/60 mt-0.5 text-right`}>{pctB}%</p>
            </div>

            {isWinnerRevealed && votedSide === 'B' && (
              <div className={`absolute inset-x-0 ${sz('top-6', 'top-16')} flex justify-center pointer-events-none z-20`}>
                <div className={`backdrop-blur-xl bg-black/40 border border-white/20 text-white ${sz('px-6 py-2.5', 'px-14 py-5')} rounded-full ${sz('text-[11px]', 'text-2xl')} font-medium tracking-[0.08em] flex items-center ${sz('gap-2', 'gap-4')} shadow-2xl animate-fade-in-down`}>
                  <Trophy size={sz(14, 32)} className="text-pink-400" strokeWidth={2.25} />
                  <span>응모완료</span>
                </div>
              </div>
            )}

          </div>

          </div>

          {/* 네비게이션 도트 — 진행 상태 표시만 */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center z-20 pointer-events-none">
            {polls.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-3' : 'bg-white/40 w-1.5'}`} />
            ))}
          </div>
          {/* 이미 응모 안내 */}
          {showAlreadyVoted && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap bg-black/80 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-center pointer-events-none">
              <p className={`text-white ${sz('text-[11px]', 'text-xl')} font-bold`}>이미 응모하셨어요 🎁</p>
              <p className={`text-white/60 ${sz('text-[9px]', 'text-base')} mt-0.5`}>다른 상품도 응모해보세요</p>
            </div>
          )}

          {/* 에러/마감 토스트 */}
          {toast && (
            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-4 py-1.5 rounded-lg ${sz('text-[11px]', 'text-lg')} font-bold shadow-lg whitespace-nowrap`}>
              {toast}
            </div>
          )}

          {/* 하트 애니메이션 */}
          {showHeart.active && (
            <div className="absolute pointer-events-none z-50 text-red-500 animate-ping" style={{ left: showHeart.x - 40, top: showHeart.y - 40 }}>
              <Heart size={80} fill="currentColor" />
            </div>
          )}

          </div>
          {mode === 'tv' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.8)] z-50 pointer-events-none" />
          )}
          {mode === 'tv' && (
            <div className="flex flex-col items-center">
              <div className="w-[180px] h-[40px] bg-gradient-to-b from-zinc-700 to-zinc-900" style={{ clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)' }} />
              <div className="w-[480px] h-[14px] rounded-b-xl bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-xl" />
            </div>
          )}
        </div>
      </div>
  );
}
