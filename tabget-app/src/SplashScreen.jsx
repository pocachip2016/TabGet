import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

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

// KT알파쇼핑 브랜드 컬러: #E30B5C
const BRAND = '#E30B5C';

export default function SplashScreen({ onEnter, onResults, isExhausted = false }) {
  const [count, setCount] = useState(8);
  const [remaining, setRemaining] = useState(() => msUntilAnnouncement());

  // 일반 카운트다운 (exhausted 아닐 때)
  useEffect(() => {
    if (isExhausted) return;
    if (count === 0) { onEnter(); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, isExhausted]);

  // 발표 카운트다운 (exhausted 일 때)
  useEffect(() => {
    if (!isExhausted) return;
    const t = setInterval(() => setRemaining(msUntilAnnouncement()), 1000);
    return () => clearInterval(t);
  }, [isExhausted]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      {/* 핸드폰 프레임 */}
      <div className="relative w-[375px] h-[667px] rounded-[40px] border-[8px] border-zinc-800 shadow-2xl overflow-hidden">
        {/* 배경 이미지 — 카메라 앵글 효과 */}
        <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover bg-camera-angle" />
        <div className="absolute inset-0 bg-black/40" />

        {/* Powered by - 맨 아래 고정 */}
        <div className="absolute bottom-5 left-0 right-0 z-20 flex justify-center">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-[10px] tracking-wider">powered by</span>
            <img
              src={KT_LOGO}
              alt="kt알파쇼핑"
              className="h-6 object-contain opacity-70"
              style={{ mixBlendMode: 'screen' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'inline';
              }}
            />
            <span className="text-[10px] font-bold hidden opacity-70" style={{ color: BRAND }}>kt알파쇼핑</span>
          </div>
        </div>

        {/* 컨텐츠: 3등분 */}
        <div className="relative z-10 grid grid-rows-3 h-full text-white select-none">

          {/* 1/3 - 로고 */}
          <div className="flex flex-col items-center justify-center gap-4">
            {/* 로고 워드마크 */}
            <div className="flex flex-col items-center gap-1">
              <div className="relative flex items-end gap-0">
                {/* Tap - 얇은 흰색 */}
                <span
                  className="text-6xl font-light tracking-tight text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  Tap
                </span>
                {/* Get - 굵고 브랜드 컬러 */}
                <span
                  className="text-6xl font-black tracking-tight"
                  style={{ color: BRAND, letterSpacing: '-0.02em' }}
                >
                  Get
                </span>
                {/* 우측 상단 작은 점 강조 */}
                <div
                  className="absolute -top-1 -right-2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: BRAND }}
                />
              </div>
              {/* 하단 라인 */}
              <div
                className="w-full h-[1.5px] rounded-full"
                style={{ background: `linear-gradient(to right, transparent, ${BRAND}, transparent)` }}
              />
              <p className="text-white/40 text-[10px] tracking-[0.35em] uppercase mt-1">
                Vote · Compare · Win
              </p>
            </div>

          </div>

          {/* 2/3 - 카운트다운 */}
          <div className="flex flex-col items-center justify-center gap-3">
            {isExhausted ? (
              <>
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <p className="text-white/60 text-xs tracking-widest">발표시간까지</p>
                  <p className="text-white text-2xl font-black tabular-nums tracking-tight">
                    {formatHMS(remaining)}
                  </p>
                  <p className="text-white/40 text-xs">남았습니다</p>
                </div>
              </>
            ) : (
              <>
                <div
                  key={count}
                  onClick={onEnter}
                  className="w-24 h-24 rounded-full flex items-center justify-center countdown-pop shadow-xl cursor-pointer transition-all duration-200 active:scale-95"
                  style={{
                    border: `2px solid ${BRAND}55`,
                    background: `radial-gradient(circle, ${BRAND}22 0%, transparent 70%)`,
                  }}
                >
                  <span className="text-5xl font-black text-white">{count}</span>
                </div>
                <p className="text-white/40 text-xs tracking-widest">Click to Start!</p>
              </>
            )}
          </div>

          {/* 3/3 - 버튼 */}
          <div className="flex items-center justify-center">
            <button
              onClick={onResults}
              className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95"
            >
              {/* 글로우 */}
              <div
                className="absolute -inset-1 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${BRAND}, #ff6b9d)` }}
              />
              {/* 본체 */}
              <div
                className="relative flex items-center gap-3 px-8 py-4 rounded-2xl shadow-xl"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #c4084e 100%)` }}
              >
                <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Trophy size={18} className="text-white" />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] text-white/60 font-semibold tracking-widest uppercase">Result</span>
                  <span className="text-base font-black text-white tracking-tight">당첨결과보기</span>
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
    </div>
  );
}
