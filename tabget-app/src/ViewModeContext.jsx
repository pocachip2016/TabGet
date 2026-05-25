import { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext({ mode: 'phone', toggle: () => {}, setMode: () => {}, orientation: 'landscape', setOrientation: () => {} });

function getSaved(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function ViewModeProvider({ children }) {
  const [mode, setMode] = useState(() => getSaved('tabget:viewMode', 'phone') === 'tv' ? 'tv' : 'phone');
  const [orientation, setOrientation] = useState(() => {
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
