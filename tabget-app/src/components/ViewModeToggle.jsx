import { useState, useEffect } from 'react';
import { useViewMode } from '../ViewModeContext';
import { enterFullscreen } from '../lib/fullscreen';

const BRAND = '#E30B5C';

export default function ViewModeToggle({ size = 'md' }) {
  const { mode, setMode, orientation, setOrientation } = useViewMode();
  const isTV = mode === 'tv';

  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => {
    const handler = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const effectivePortrait = orientation === 'portrait' ? true : orientation === 'landscape' ? false : vw <= vh;

  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin');
  useEffect(() => {
    const handler = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const goAdmin = () => { enterFullscreen(); window.location.hash = '#admin'; };
  const goMain  = (newMode) => {
    enterFullscreen();
    if (window.location.hash === '#admin') window.location.hash = '';
    setMode(newMode);
  };
  const goRestart = () => {
    enterFullscreen();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tabget:')) localStorage.removeItem(key);
    }
    if (window.location.hash === '#admin') window.location.hash = '';
    window.dispatchEvent(new Event('tabget:restart'));
  };

  // sm / md: compact inline pill toggle (unchanged)
  if (size !== 'lg') {
    const outer = 'p-0.5 rounded-xl gap-0.5 flex items-center';
    const pill = size === 'sm'
      ? 'px-2.5 py-0.5 rounded-lg text-[11px] font-semibold'
      : 'px-3 py-1 rounded-lg text-xs font-semibold';
    return (
      <div className={`${outer} bg-zinc-800/80 backdrop-blur-md border border-white/10 select-none`}>
        <button
          onClick={() => goMain('phone')}
          className={`${pill} transition-all duration-200 ${!isTV && !isAdmin ? 'bg-white text-zinc-900' : 'text-white/35'}`}
        >
          📱Phone
        </button>
        <button
          onClick={() => goMain('tv')}
          className={`${pill} transition-all duration-200 ${isTV && !isAdmin ? 'bg-white text-zinc-900' : 'text-white/35'}`}
        >
          📺TV
        </button>
      </div>
    );
  }

  // lg: 스플래시 화면용 — 앱 스타일 버튼 3개
  const base = 'w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold tracking-wide transition-all duration-200 active:scale-95 select-none';

  return (
    <div className="flex flex-col gap-2 w-24">
      <button
        onClick={() => goMain('phone')}
        className={`${base} ${!isTV && !isAdmin ? 'text-white shadow-lg' : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'}`}
        style={!isTV && !isAdmin ? { background: `linear-gradient(135deg, ${BRAND}, #c4084e)`, boxShadow: `0 4px 20px ${BRAND}55` } : {}}
      >
        📱 Phone
      </button>
      <button
        onClick={() => goMain('tv')}
        className={`${base} ${isTV && !isAdmin ? 'text-white shadow-lg' : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300'}`}
        style={isTV && !isAdmin ? { background: `linear-gradient(135deg, ${BRAND}, #c4084e)`, boxShadow: `0 4px 20px ${BRAND}55` } : {}}
      >
        📺 TV
      </button>
      <div className="h-px bg-zinc-200 my-0.5" />
      <button
        onClick={goAdmin}
        className={`${base} ${isAdmin ? 'text-white shadow-lg' : 'bg-zinc-200 text-zinc-400 hover:bg-zinc-300 hover:text-zinc-500'}`}
        style={isAdmin ? { background: `linear-gradient(135deg, ${BRAND}, #c4084e)`, boxShadow: `0 4px 20px ${BRAND}55` } : {}}
      >
        🛠️ Admin
      </button>
      <div className="h-px bg-zinc-200 my-0.5" />
      <button
        onClick={() => setOrientation(effectivePortrait ? 'landscape' : 'portrait')}
        className={`${base} bg-zinc-200 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-700`}
      >
        {effectivePortrait ? '↔ 가로화면' : '↕ 세로화면'}
      </button>
      <div className="h-px bg-zinc-200 my-0.5" />
      <button
        onClick={goRestart}
        className={`${base} bg-zinc-200 text-zinc-400 hover:bg-zinc-300 hover:text-zinc-500`}
      >
        🔄 다시시작
      </button>
    </div>
  );
}
