import { useState, useEffect, useRef } from 'react';
import { useViewMode } from '../ViewModeContext';

const INTERVAL_MIN = 1000;
const INTERVAL_MAX = 2000;
const MAX_MSGS = 10;
let _keySeq = 0;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BattleFeed({ side, initialMessages = [] }) {
  const pool = side ? initialMessages.filter(m => m.side === side) : initialMessages;
  const [displayed, setDisplayed] = useState([]);
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);
  const { mode } = useViewMode();
  const isTV = mode === 'tv';

  useEffect(() => {
    if (pool.length === 0) { setDisplayed([]); return; }
    queueRef.current = shuffle(pool);
    setDisplayed([]);

    const tick = () => {
      if (queueRef.current.length === 0) queueRef.current = shuffle(pool);
      const next = queueRef.current.shift();
      setDisplayed(prev => [...prev, { ...next, _k: ++_keySeq }].slice(-MAX_MSGS));
      timerRef.current = setTimeout(tick, INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN));
    };

    timerRef.current = setTimeout(tick, INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN));
    return () => clearTimeout(timerRef.current);
  }, [initialMessages.length, side]);

  // 새 메시지마다 부드럽게 아래로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [displayed]);

  if (displayed.length === 0) return null;

  const isB = side === 'B';
  const nameColor = isB ? 'text-red-300' : 'text-blue-300';
  // TV: 4개, phone: 3개 기준 높이 (메시지 1개 ≈ TV 52px, phone 40px)
  const h = isTV ? '216px' : '124px';
  const mask = 'linear-gradient(to bottom, transparent 0%, black 40%)';

  return (
    <div
      ref={scrollRef}
      className="pointer-events-none w-full overflow-y-scroll"
      style={{
        height: h,
        scrollbarWidth: 'none',
        maskImage: mask,
        WebkitMaskImage: mask,
        scrollBehavior: 'smooth',
      }}
    >
      {/* paddingTop = 컨테이너 높이 → 메시지는 항상 visible bottom 에서 시작, 새 메시지마다 smooth scroll 로 위로 올라감 */}
      <div
        className={`flex flex-col gap-1 ${isB ? 'items-end' : 'items-start'}`}
        style={{ paddingTop: h }}
      >
        {displayed.map((msg) => (
          <div
            key={msg._k}
            className={`bg-black/45 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg ${isB ? 'text-right' : ''}`}
          >
            <p className={`${nameColor} ${isTV ? 'text-sm' : 'text-[11px]'} font-bold leading-tight truncate drop-shadow`}>
              {msg.authorName}
            </p>
            <p className={`text-white ${isTV ? 'text-xs' : 'text-[11px]'} leading-tight drop-shadow`}>
              {msg.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
