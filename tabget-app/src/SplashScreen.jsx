import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import GameRulesModal from './components/GameRulesModal';
import ViewModeToggle from './components/ViewModeToggle';
import { useViewMode } from './ViewModeContext';

// 다음 00:30까지 남은 ms
function msUntilAnnouncement() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(0, 30, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function formatHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}시 ${mm}분 ${ss}초`;
}

const BG_IMAGE = "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=1200";
const KT_LOGO = "https://api.brandb.net/api/v2/common/image?fileId=2887";
const BRAND = '#E30B5C';

export default function SplashScreen({ onEnter, onResults, isExhausted = false }) {
  const [count, setCount] = useState(8);
  const [remaining, setRemaining] = useState(() => msUntilAnnouncement());
  const [showRules, setShowRules] = useState(!isExhausted);
  const [tvScale, setTvScale] = useState(1);

  const { mode } = useViewMode();
  const sz = (phone, tv) => mode === 'tv' ? tv : phone;
  const isTV = mode === 'tv';

  useEffect(() => {
    if (mode !== 'tv') { setTvScale(1); return; }
    const calc = () => setTvScale(Math.min(1, window.innerWidth / 1360, window.innerHeight / 820));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [mode]);

  // 일반 카운트다운 (exhausted 아닐 때, 모달 표시 중엔 정지)
  useEffect(() => {
    if (isExhausted) return;
    if (showRules) return;
    if (count === 0) { onEnter(); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, isExhausted, showRules]);

  // 발표 카운트다운 (exhausted 일 때, 모달 표시 중엔 정지)
  useEffect(() => {
    if (!isExhausted) return;
    if (showRules) return;
    const t = setInterval(() => setRemaining(msUntilAnnouncement()), 1000);
    return () => clearInterval(t);
  }, [isExhausted, showRules]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      {/* ViewModeToggle — 스케일 바깥에 고정 */}
      <div className="fixed top-4 left-4 z-50">
        <ViewModeToggle size="lg" />
      </div>

      <div
        className="flex flex-col items-center"
        style={isTV ? { transform: `scale(${tvScale})`, transformOrigin: 'top center' } : {}}
      >
        {/* 프레임 */}
        <div className={sz(
          'relative w-[300px] h-[534px] rounded-[32px] border-[6px] border-zinc-800 shadow-2xl overflow-hidden',
          'relative w-[1280px] h-[720px] rounded-xl border-[20px] border-zinc-800 shadow-2xl overflow-hidden'
        )}>
          <GameRulesModal open={showRules} onStart={() => setShowRules(false)} />

          {/* 배경 이미지 */}
          <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover bg-camera-angle" />
          <div className="absolute inset-0 bg-black/40" />

          {/* Powered by — 하단 고정 */}
          <div className="absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-2">
            <span className={`text-white/40 ${sz('text-[9px]', 'text-sm')} tracking-wider`}>powered by</span>
            <img
              src={KT_LOGO}
              alt="kt알파쇼핑"
              className={`${sz('h-6', 'h-10')} object-contain opacity-70`}
              style={{ mixBlendMode: 'screen' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline';
              }}
            />
            <span className={`${sz('text-[9px]', 'text-sm')} font-bold hidden opacity-70`} style={{ color: BRAND }}>kt알파쇼핑</span>
          </div>

          {/* 콘텐츠: phone = 3행, TV = 3열 */}
          <div className="relative z-10 h-full text-white select-none grid grid-rows-3">

            {/* 1구역 — 로고 */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="relative flex items-end gap-0">
                  <span
                    className={`${sz('text-5xl', 'text-[7rem]')} font-light tracking-tight text-white`}
                    style={{ letterSpacing: '-0.02em' }}
                  >Tap</span>
                  <span
                    className={`${sz('text-5xl', 'text-[7rem]')} font-black tracking-tight`}
                    style={{ color: BRAND, letterSpacing: '-0.02em' }}
                  >Get</span>
                  <div
                    className={`absolute -top-1 -right-2 ${sz('w-2 h-2', 'w-4 h-4')} rounded-full`}
                    style={{ backgroundColor: BRAND }}
                  />
                </div>
                <div
                  className="w-full h-[1.5px] rounded-full"
                  style={{ background: `linear-gradient(to right, transparent, ${BRAND}, transparent)` }}
                />
                <p className={`text-white/40 ${sz('text-[9px]', 'text-sm')} tracking-[0.35em] uppercase mt-1`}>
                  Vote · Compare · Win
                </p>
              </div>
            </div>

            {/* 2구역 — 카운트다운 */}
            <div className="flex flex-col items-center justify-center gap-3">
              {isExhausted ? (
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <p className={`text-white/60 ${sz('text-[11px]', 'text-base')} tracking-widest`}>발표시간까지</p>
                  <p className={`text-white ${sz('text-xl', 'text-5xl')} font-black tabular-nums tracking-tight`}>
                    {formatHMS(remaining)}
                  </p>
                  <p className={`text-white/40 ${sz('text-[11px]', 'text-base')}`}>남았습니다</p>
                </div>
              ) : (
                <>
                  <div
                    key={count}
                    onClick={onEnter}
                    className={`${sz('w-24 h-24', 'w-52 h-52')} rounded-full flex items-center justify-center countdown-pop shadow-xl cursor-pointer transition-all duration-200 active:scale-95`}
                    style={{
                      border: `2px solid ${BRAND}55`,
                      background: `radial-gradient(circle, ${BRAND}22 0%, transparent 70%)`,
                    }}
                  >
                    <span className={`${sz('text-4xl', 'text-9xl')} font-black text-white`}>{count}</span>
                  </div>
                  <p className={`text-white/40 ${sz('text-[11px]', 'text-base')} tracking-widest`}>Click to Start!</p>
                </>
              )}
            </div>

            {/* 3구역 — 당첨결과 버튼 */}
            <div className="flex items-center justify-center">
              <button
                onClick={onResults}
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-95 ${isExhausted ? 'group hover:scale-105' : 'hover:brightness-110'}`}
              >
                {isExhausted && (
                  <div className="absolute -inset-1 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300"
                    style={{ background: `linear-gradient(135deg, ${BRAND}, #ff6b9d)` }} />
                )}
                <div
                  className={`relative flex items-center gap-3 ${sz('px-8 py-4', 'px-12 py-6')} rounded-2xl shadow-xl`}
                  style={isExhausted
                    ? { background: `linear-gradient(135deg, ${BRAND} 0%, #c4084e 100%)` }
                    : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }
                  }
                >
                  <div className={`${sz('w-9 h-9', 'w-14 h-14')} rounded-full flex items-center justify-center flex-shrink-0`}
                    style={{ background: isExhausted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                    <Trophy size={sz(18, 28)} style={{ color: isExhausted ? 'white' : 'rgba(255,255,255,0.35)' }} />
                  </div>
                  <div className="flex flex-col items-start leading-tight">
                    <span className={`${sz('text-[9px]', 'text-sm')} font-semibold tracking-widest uppercase`}
                      style={{ color: isExhausted ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>Result</span>
                    <span className={`${sz('text-sm', 'text-2xl')} font-black tracking-tight`}
                      style={{ color: isExhausted ? 'white' : 'rgba(255,255,255,0.4)' }}>당첨결과보기</span>
                  </div>
                  <div className={`${sz('w-7 h-7', 'w-10 h-10')} rounded-full flex items-center justify-center ml-1`}
                    style={{ background: isExhausted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}>
                    <svg width={sz(12, 18)} height={sz(12, 18)} viewBox="0 0 12 12" fill="none">
                      <path d="M2 6h8M6 2l4 4-4 4"
                        stroke={isExhausted ? 'white' : 'rgba(255,255,255,0.35)'}
                        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
