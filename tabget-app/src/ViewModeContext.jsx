import { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext({ mode: 'phone', toggle: () => {} });

function getSavedMode() {
  try {
    return localStorage.getItem('tabget:viewMode') === 'tv' ? 'tv' : 'phone';
  } catch {
    return 'phone';
  }
}

export function ViewModeProvider({ children }) {
  const [mode, setMode] = useState(getSavedMode);

  const toggle = () => setMode(m => {
    const next = m === 'phone' ? 'tv' : 'phone';
    try { localStorage.setItem('tabget:viewMode', next); } catch {}
    return next;
  });

  // 다른 탭에서 변경 시 동기화
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'tabget:viewMode') setMode(e.newValue === 'tv' ? 'tv' : 'phone');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <ViewModeContext.Provider value={{ mode, toggle }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
