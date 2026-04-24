import React, { useState, useRef, useEffect } from 'react';
import { Heart, Users, ChevronLeft, ChevronRight, Trophy, Volume2 } from 'lucide-react';
import SplashScreen from './SplashScreen';
import ProductSlideshow from './components/ProductSlideshow';
import ViewModeToggle from './components/ViewModeToggle';
import { useViewMode } from './ViewModeContext';
import { fetchPolls, submitVote, ApiError } from './api/client';
import { getVisitorId } from './lib/visitor';
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
    itemA: "럭셔리 세단",
    itemB: "강력한 SUV",
    imgA: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800",
    imgB: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800",
    votesA: 21000,
    votesB: 19500,
  },
];

const CHAT_MESSAGES = [
  "이거 진짜 최고다 👍",
  "압도적 1위!",
  "이미 샀어요 ㅋㅋ",
  "역시 믿고 선택",
  "완전 내 스타일 ❤️",
  "더블클릭 고!!!!",
  "이벤트 당첨되고 싶다 🙏",
  "친구한테도 추천했어요",
  "이게 답이지",
  "진짜 갖고싶다...",
  "가격 대비 최고",
  "벌써 3번째 참여 중",
  "이거 사면 인생 바뀜",
  "디자인 미쳤다 😍",
  "무조건 이쪽",
  "1등 확실함",
  "저도 참여했어요!",
  "이거 실제로 써봤는데 진짜 좋음",
  "이벤트 당첨 되면 선물할 거예요 🎁",
  "퀄리티 실화냐",
];

const NICKNAMES = [
  "익명의 곰돌이", "행운의 별빛", "구름위의 고양이", "새벽세시반", "핑크노을",
  "초코라떼", "달빛소나타", "열정파워", "오늘도화이팅", "사탕수수",
  "포근한이불", "도토리다람쥐", "반짝이는눈", "설레는마음", "봄날의햇살",
];

function ChatFeed({ active }) {
  const [messages, setMessages] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      clearInterval(intervalRef.current);
      setMessages([]);
      return;
    }

    const addMessage = () => {
      const text = CHAT_MESSAGES[Math.floor(Math.random() * CHAT_MESSAGES.length)];
      const nick = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
      setMessages((prev) => {
        const next = [...prev, { id: Date.now(), nick, text }];
        return next.slice(-6); // 최대 6개 유지
      });
    };

    addMessage();
    intervalRef.current = setInterval(addMessage, 1200 + Math.random() * 800);

    return () => clearInterval(intervalRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-1/3 flex flex-col justify-end pb-20 px-2 z-10 pointer-events-none overflow-hidden">
      <div className="flex flex-col gap-1 border border-white/30 rounded-lg p-3">
        {messages.slice(-3).map((msg, i) => (
          <div
            key={msg.id}
            className="chat-message bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1"
            style={{ opacity: 0.4 + i * 0.3 }}
          >
            <p className="text-green-300 text-[10px] font-bold leading-tight truncate">{msg.nick}</p>
            <p className="text-white text-[10px] leading-tight">{msg.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const [polls, setPolls] = useState([]);
  const [votedPollIds, setVotedPollIds] = useState([]);
  const [votedSides, setVotedSides] = useState({}); // { [pollId]: 'A' | 'B' }
  const [showAllDone, setShowAllDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const visitorIdRef = useRef(null);

  const { mode } = useViewMode();
  const sz = (phone, tv) => mode === 'tv' ? tv : phone;
  const [tvScale, setTvScale] = useState(1);
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

  // TV 뷰포트 축소 (1280×720 미만 창)
  useEffect(() => {
    if (mode !== 'tv') { setTvScale(1); return; }
    const calc = () => setTvScale(Math.min(1, window.innerWidth / 1360, window.innerHeight / 820));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [mode]);

  // TV 키보드 네비게이션
  useEffect(() => {
    if (mode !== 'tv') return;
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSet(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextSet(); }
      else if (e.key === 'Enter') { e.preventDefault(); handleClick(selectedSide ?? 'A'); }
      else if (e.key === ' ') { e.preventDefault(); if (selectedSide) handleDoubleClick(selectedSide, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, selectedSide]);

  const currentSet = polls[currentIndex];
  const hasCurrentVoted = currentSet ? votedPollIds.includes(currentSet.id) : false;
  const totalDisplay = displayVotesA + displayVotesB;
  const pctA = totalDisplay > 0 ? Math.round((displayVotesA / totalDisplay) * 100) : 50;
  const pctB = totalDisplay > 0 ? 100 - pctA : 50;

  // 선택 시: 0 → 목표값 카운트업 애니메이션
  const animateCount = (target, setter, onComplete) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const duration = 1000;
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

    const targetA = currentSet.votesA;
    const targetB = currentSet.votesB;

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
    setDisplayVotesA(p.votesA);
    setDisplayVotesB(p.votesB);
    const prevSide = votedSides[p.id] ?? null;
    setVotedSide(prevSide);
    setSelectedSide(prevSide);
    setIsWinnerRevealed(!!prevSide);
  }, [currentIndex, polls]);

  // 모든 세트 응모 완료 감지 (이번 세션에 투표가 1번 이상 발생한 경우만)
  useEffect(() => {
    if (!voteCastRef.current) return;
    if (polls.length === 0) return;
    if (polls.every((p) => votedPollIds.includes(p.id))) {
      const t1 = setTimeout(() => {
        setShowAllDone(true);
        const t2 = setTimeout(() => {
          setShowAllDone(false);
          setScreen('results');
        }, 4000);
        return () => clearTimeout(t2);
      }, 2500);
      return () => clearTimeout(t1);
    }
  }, [votedPollIds, polls]);

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
      setTimeout(() => setIsWinnerRevealed(true), 2000);
    } catch (err) {
      // Rollback optimistic counter
      if (side === 'A') setDisplayVotesA((v) => Math.max(0, v - 1));
      else setDisplayVotesB((v) => Math.max(0, v - 1));

      if (err instanceof ApiError && err.code === 'already_voted') {
        setVotedPollIds((ids) => (ids.includes(pollId) ? ids : [...ids, pollId]));
        setTimeout(() => setIsWinnerRevealed(true), 2000);
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

  const nextSet = () => {
    if (polls.length === 0) return;
    resetSet();
    setCurrentIndex((prev) => (prev + 1) % polls.length);
  };

  const prevSet = () => {
    if (polls.length === 0) return;
    resetSet();
    setCurrentIndex((prev) => (prev - 1 + polls.length) % polls.length);
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
    const WINNERS = [
      { id: 1, nick: "행운의별빛", review: "진짜 당첨될 줄 몰랐어요!! 너무 행복해요 🎉", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop", prize: "프리미엄 무선 이어폰" },
      { id: 2, nick: "초코라떼맛", review: "친구한테 자랑했더니 부러워해요 ㅋㅋ 감사합니다!", img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop", prize: "최신형 스마트워치" },
      { id: 3, nick: "봄날햇살77", review: "이런 이벤트 처음인데 당첨되다니 대박 🙏", img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop", prize: "화이트 스니커즈" },
      { id: 4, nick: "달빛소나타", review: "배송도 빠르고 상품도 너무 좋아요! 또 참여할게요", img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop", prize: "아이스 아메리카노 세트" },
      { id: 5, nick: "포근한이불", review: "반신반의했는데 진짜 당첨!! 믿고 참여하세요 👍", img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop", prize: "고성능 게이밍 폰" },
      { id: 6, nick: "구름위고양이", review: "남자친구랑 같이 했는데 제가 당첨됐어요 😍", img: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop", prize: "럭셔리 세단 시승권" },
      { id: 7, nick: "새벽세시반", review: "kt알파쇼핑 이벤트 최고! 매일 참여합니다", img: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=200&h=200&fit=crop", prize: "최신형 스마트워치" },
      { id: 8, nick: "열정파워맨", review: "상품 퀄리티 실화냐... 너무 만족스러워요 🎁", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop", prize: "휴대용 게임 콘솔" },
    ];

    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="relative w-[375px] h-[667px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl overflow-hidden bg-zinc-950">
          {/* 헤더 */}
          <div className="flex flex-col items-center pt-5 pb-3 border-b border-white/10">
            <h2 className="text-2xl font-black">
              <span className="text-white">Tap</span>
              <span style={{ color: '#E30B5C' }}>Get</span>
              <span className="text-white/40 text-base font-normal ml-2">당첨결과</span>
            </h2>
            <div className="absolute top-4 right-4 z-10">
              <ViewModeToggle size="sm" />
            </div>
          </div>

          {/* 스크롤 영역 */}
          <div className="h-full overflow-y-auto pb-20" style={{ scrollbarWidth: 'none' }}>
            {/* 득표율 섹션 */}
            <div className="px-5 pt-4 pb-3">
              <p className="text-white/40 text-[10px] tracking-widest uppercase mb-3">투표 결과</p>
              {VS_DATA.map((set) => {
                const total = set.votesA + set.votesB;
                const pA = Math.round((set.votesA / total) * 100);
                const pB = 100 - pA;
                return (
                  <div key={set.id} className="mb-4">
                    <div className="flex justify-between text-[11px] text-white/50 mb-1">
                      <span className="truncate w-28">{set.itemA}</span>
                      <span className="truncate w-28 text-right">{set.itemB}</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-400" style={{ width: `${pA}%` }} />
                      <div className="bg-pink-400" style={{ width: `${pB}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-blue-400 font-bold">{pA}%</span>
                      <span className="text-white/30">{total.toLocaleString()}명</span>
                      <span className="text-pink-400 font-bold">{pB}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 구분선 */}
            <div className="mx-5 border-t border-white/10 mb-4" />

            {/* 당첨자 후기 섹션 */}
            <div className="px-5">
              <p className="text-white/40 text-[10px] tracking-widest uppercase mb-3">당첨자 후기</p>
              <div className="grid grid-cols-2 gap-3">
                {WINNERS.map((w) => (
                  <div key={w.id} className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                    {/* 인증사진 */}
                    <div className="relative">
                      <img src={w.img} alt={w.nick} className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E30B5C' }} />
                        <span className="text-white text-[9px] font-bold">{w.nick}</span>
                      </div>
                    </div>
                    {/* 후기 */}
                    <div className="px-2.5 py-2">
                      <p className="text-[9px] font-semibold mb-1" style={{ color: '#E30B5C' }}>{w.prize}</p>
                      <p className="text-white/70 text-[9px] leading-relaxed">{w.review}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-16" />
          </div>

          {/* 메인으로 버튼 - 하단 고정 */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-10 pt-6 bg-gradient-to-t from-zinc-950 to-transparent">
            <button
              onClick={() => setScreen('splash')}
              className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute -inset-1 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #E30B5C, #ff6b9d)' }} />
              <div className="relative flex items-center gap-3 px-8 py-4 rounded-2xl shadow-xl"
                style={{ background: 'linear-gradient(135deg, #E30B5C 0%, #c4084e 100%)' }}>
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] text-white/60 font-semibold tracking-widest uppercase">Home</span>
                  <span className="text-base font-black text-white tracking-tight">메인으로</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center ml-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-[667px] h-[375px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl flex items-center justify-center text-white/70 text-sm bg-zinc-950">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-[667px] h-[375px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-3 bg-zinc-950 text-white px-10 text-center">
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
        <div className="w-[667px] h-[375px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl flex items-center justify-center text-white/60 text-sm bg-zinc-950">
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-white font-sans">
      {/* 프레임 + 스탠드 컨테이너 */}
      <div className="fixed left-1/2 -translate-x-1/2 z-50" style={{ top: 'max(12px, calc(50vh - 450px))' }}>
        <ViewModeToggle size={sz('sm', 'lg')} />
      </div>
      <div
        className="flex flex-col items-center"
        style={mode === 'tv' ? { transform: `scale(${tvScale})`, transformOrigin: 'top center' } : {}}
      >
      <div ref={frameRef} className={sz(
        'relative w-[667px] h-[375px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl overflow-hidden',
        'relative w-[1280px] h-[720px] border-[20px] border-zinc-800 rounded-xl shadow-2xl overflow-hidden'
      )}>
        <div className="flex w-full h-full flex-row">

          {/* Section A */}
          <div
            className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer
              ${isWinnerRevealed && votedSide === 'B' ? 'opacity-40 grayscale blur-sm'
                : selectedSide === 'A' ? 'opacity-100 ring-[3px] ring-white/50 ring-inset brightness-105'
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

            <div className="absolute bottom-4 left-4 right-4">
              <h3 className={`${sz('text-base', 'text-5xl')} font-bold drop-shadow-md text-white`}>{currentSet.itemA}</h3>
              <div className={`flex items-center gap-1.5 mt-1 ${sz('text-xs', 'text-2xl')} text-white/80`}>
                <Users size={sz(12, 32)} />
                <span>{displayVotesA.toLocaleString()}명 참여 중</span>
              </div>
              <div className={`mt-1.5 ${sz('h-1.5', 'h-3')} rounded-full bg-white/20 overflow-hidden`}>
                <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${pctA}%` }} />
              </div>
              <p className={`${sz('text-[10px]', 'text-xl')} text-white/60 mt-0.5`}>{pctA}%</p>
            </div>

            {isWinnerRevealed && votedSide === 'A' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`bg-gradient-to-r from-pink-500 to-red-500 text-white px-5 py-2.5 rounded-2xl font-black ${sz('text-lg', 'text-5xl')} flex items-center gap-2 shadow-xl animate-bounce`}>
                  <Trophy size={sz(20, 48)} /> 응모완료!
                </div>
              </div>
            )}

            <div className="absolute top-4 left-4 bg-black/40 p-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <Volume2 size={14} />
            </div>

            {!votedSide && (selectedSide === 'A' || !selectedSide) && (
              <div className="animate-blink absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium z-20 whitespace-nowrap pointer-events-none">
                <span className="text-yellow-200 font-bold">클릭</span><span className="text-white font-bold">(선택)</span>
                <span className="mx-1.5"> </span>
                <span className="text-yellow-400 font-bold">더블클릭</span><span className="text-white font-bold">(이벤트참여)</span>
              </div>
            )}

            <ChatFeed active={selectedSide === 'A'} />
          </div>

          {/* VS 배지 */}
          <div className={`absolute z-10 ${sz('w-10 h-10 text-sm', 'w-24 h-24 text-3xl')} rounded-full bg-white text-black font-black flex items-center justify-center shadow-xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`}>
            VS
          </div>

          {/* Section B */}
          <div
            className={`relative flex-1 overflow-hidden transition-all duration-500 cursor-pointer
              ${isWinnerRevealed && votedSide === 'A' ? 'opacity-40 grayscale blur-sm'
                : selectedSide === 'B' ? 'opacity-100 ring-[3px] ring-white/50 ring-inset brightness-105'
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

            <div className="absolute bottom-4 left-4 right-4">
              <h3 className={`${sz('text-base', 'text-5xl')} font-bold drop-shadow-md text-white`}>{currentSet.itemB}</h3>
              <div className={`flex items-center gap-1.5 mt-1 ${sz('text-xs', 'text-2xl')} text-white/80`}>
                <Users size={sz(12, 32)} />
                <span>{displayVotesB.toLocaleString()}명 참여 중</span>
              </div>
              <div className={`mt-1.5 ${sz('h-1.5', 'h-3')} rounded-full bg-white/20 overflow-hidden`}>
                <div className="h-full bg-pink-400 rounded-full transition-all duration-300" style={{ width: `${pctB}%` }} />
              </div>
              <p className={`${sz('text-[10px]', 'text-xl')} text-white/60 mt-0.5`}>{pctB}%</p>
            </div>

            {isWinnerRevealed && votedSide === 'B' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`bg-gradient-to-r from-pink-500 to-red-500 text-white px-5 py-2.5 rounded-2xl font-black ${sz('text-lg', 'text-5xl')} flex items-center gap-2 shadow-xl animate-bounce`}>
                  <Trophy size={sz(20, 48)} /> 응모완료!
                </div>
              </div>
            )}

            <div className="absolute top-4 right-4 bg-black/40 p-1.5 rounded-full backdrop-blur-sm border border-white/10">
              <Volume2 size={14} />
            </div>

            {!votedSide && selectedSide === 'B' && (
              <div className="animate-blink absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium z-20 whitespace-nowrap pointer-events-none">
                <span className="text-yellow-200 font-bold">클릭</span><span className="text-white font-bold">(선택)</span>
                <span className="mx-1.5"> </span>
                <span className="text-yellow-400 font-bold">더블클릭</span><span className="text-white font-bold">(이벤트참여)</span>
              </div>
            )}

            <ChatFeed active={selectedSide === 'B'} />
          </div>

          {/* 네비게이션 — 좌우 버튼 세로 중앙, 도트 하단 */}
          <button
            onClick={(e) => { e.stopPropagation(); prevSet(); }}
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center pointer-events-auto hover:bg-white/40 transition ${votedSide ? 'animate-blink' : ''}`}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); nextSet(); }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center pointer-events-auto hover:bg-white/40 transition ${votedSide ? 'animate-blink' : ''}`}
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 items-center z-20 pointer-events-none">
            {polls.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white w-3' : 'bg-white/40 w-1.5'}`} />
            ))}
          </div>
          {/* 이미 응모 안내 */}
          {showAlreadyVoted && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap bg-black/80 backdrop-blur-md border border-white/20 px-4 py-2 rounded-xl text-center pointer-events-none">
              <p className={`text-white ${sz('text-xs', 'text-xl')} font-bold`}>이미 응모하셨어요 🎁</p>
              <p className={`text-white/60 ${sz('text-[10px]', 'text-base')} mt-0.5`}>다른 상품도 응모해보세요</p>
            </div>
          )}

          {/* 참여 완료 토스트 */}
          {votedSide && !isWinnerRevealed && (
            <div className={`absolute bottom-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold animate-pulse shadow-lg z-20 whitespace-nowrap ${sz('text-sm', 'text-xl')}`}>
              참여 완료! 결과를 기다려주세요 🎁
            </div>
          )}

          {/* 에러/마감 토스트 */}
          {toast && (
            <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 text-white px-4 py-1.5 rounded-lg ${sz('text-xs', 'text-lg')} font-bold shadow-lg whitespace-nowrap`}>
              {toast}
            </div>
          )}

          {/* 하트 애니메이션 */}
          {showHeart.active && (
            <div className="absolute pointer-events-none z-50 text-red-500 animate-ping" style={{ left: showHeart.x - 40, top: showHeart.y - 40 }}>
              <Heart size={80} fill="currentColor" />
            </div>
          )}

          {/* 전체 응모 완료 오버레이 */}
          {showAllDone && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
              <div className="text-5xl mb-4 animate-bounce">🎉</div>
              <p className="text-white text-lg font-black text-center leading-snug px-6">
                오늘은 다 참여하셨습니다.<br />두둥~~
              </p>
              <p className="text-white/70 text-sm mt-3 font-medium">24:30분에 발표합니다.</p>
              <p className="text-white/40 text-xs mt-6 animate-pulse">결과 페이지로 이동 중...</p>
            </div>
          )}
          </div>
          {mode === 'tv' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.8)] z-50 pointer-events-none" />
          )}
        </div>
        {mode === 'tv' && (
          <>
            <div className="w-40 h-3 bg-zinc-800 rounded-b-sm" />
            <div className="w-72 h-2 bg-zinc-700 rounded-full shadow-lg" />
          </>
        )}
      </div>
    </div>
  );
}
