import { useEffect, useState } from 'react';
import { useViewMode } from '../ViewModeContext';

// iOS Safari 주소창 표시/숨김 시 innerHeight 가 변동해
// vw <= vh 자동판정이 깜빡인다. matchMedia 는 이런 변동에 영향 없음.
function readMatch() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(orientation: portrait)').matches;
}

export function useIsPortrait() {
  const { orientation } = useViewMode();
  const [auto, setAuto] = useState(readMatch);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const handler = (e) => setAuto(e.matches);
    mq.addEventListener('change', handler);
    setAuto(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (orientation === 'portrait') return true;
  if (orientation === 'landscape') return false;
  return auto;
}
