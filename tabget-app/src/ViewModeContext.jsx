import { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext({ mode: 'phone', toggle: () => {}, setMode: () => {}, orientation: 'landscape', setOrientation: () => {} });

function getSaved(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function ViewModeProvider({ children }) {
  const isMobileDev = typeof window !== 'undefined' && window.innerWidth <= 640;
  const [mode, setMode] = useState(() => {
    // 모바일 디바이스는 localStorage 무시 — 항상 phone (TV frame은 화면 넘침)
    if (isMobileDev) return 'phone';
    const saved = (() => { try { return localStorage.getItem('tabget:viewMode'); } catch { return null; } })();
    if (saved === 'tv' || saved === 'phone') return saved;
    return 'tv';  // PC 첫 진입: TV
  });
  const [orientation, setOrientation] = useState(() => {
    // 모바일 디바이스는 항상 landscape (세로 frame은 메뉴 가림)
    if (isMobileDev) return 'landscape';
    const v = getSaved('tabget:orientation', 'landscape');
    return ['portrait', 'landscape', 'auto'].includes(v) ? v : 'landscape';
  });

  const setModeAndSave = (next) => {
    setMode(next);
    try { localStorage.setItem('tabget:viewMode', next); } catch {}
  };

  const toggle = () => setMode(m => {
    const next = m === 'phone' ? 'tv' : 'phone';
    try { localStorage.setItem('tabget:viewMode', next); } catch {}
    return next;
  });

  const setOrientationAndSave = (next) => {
    setOrientation(next);
    try { localStorage.setItem('tabget:orientation', next); } catch {}
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'tabget:viewMode') setMode(e.newValue === 'tv' ? 'tv' : 'phone');
      if (e.key === 'tabget:orientation') {
        const v = e.newValue;
        if (['portrait', 'landscape', 'auto'].includes(v)) setOrientation(v);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <ViewModeContext.Provider value={{ mode, toggle, setMode: setModeAndSave, orientation, setOrientation: setOrientationAndSave }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
