import { useState, useEffect, useRef } from 'react';
import { useViewMode } from '../ViewModeContext';

const INTERVAL_MIN = 500;
const INTERVAL_MAX = 1500;

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
  const { mode } = useViewMode();
  const isTV = mode === 'tv';

  useEffect(() => {
    if (pool.length === 0) {
      setDisplayed([]);
      return;
    }

    queueRef.current = shuffle(pool);
    setDisplayed([]);

    const tick = () => {
      if (queueRef.current.length === 0) {
        queueRef.current = shuffle(pool);
      }
      const next = queueRef.current.shift();
      setDisplayed(prev => [...prev.slice(-1), next]);
      const delay = INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN);
      timerRef.current = setTimeout(tick, delay);
    };

    const initial = INTERVAL_MIN + Math.random() * (INTERVAL_MAX - INTERVAL_MIN);
    timerRef.current = setTimeout(tick, initial);
    return () => clearTimeout(timerRef.current);
  }, [initialMessages.length, side]);

  if (displayed.length === 0) return null;

  const isB = side === 'B';
  const nameColor = isB ? 'text-red-300' : 'text-blue-300';

  return (
    <div className={`flex flex-col gap-1 pointer-events-none w-full ${isB ? 'items-end' : 'items-start'}`}>
      {displayed.map((msg, i, arr) => {
        const opacity = Math.max(0.75, (i + 1) / arr.length);
        return (
          <div
            key={`${msg.id}-${i}`}
            className={`bg-black/45 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg ${isB ? 'text-right' : ''}`}
            style={{ opacity }}
          >
            <p className={`${nameColor} ${isTV ? 'text-sm' : 'text-[11px]'} font-bold leading-tight truncate drop-shadow`}>
              {msg.authorName}
            </p>
            <p className={`text-white ${isTV ? 'text-xs' : 'text-[11px]'} leading-tight drop-shadow`}>
              {msg.content}
            </p>
          </div>
        );
      })}
    </div>
  );
}
