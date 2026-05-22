import { useEffect } from 'react';
import { useViewMode } from '../ViewModeContext';

const BRAND = '#E30B5C';

const P = ({ children }) => <span style={{ color: BRAND, fontWeight: 700 }}>{children}</span>;

const rules = [
  { text: '원하는 상품 더블탭 → 투표' },
  { text: '← → 로 다음 세트 이동' },
  { text: '5세트 완료 시 당첨 페이지로' },
  { node: <>Winner상품 <P>Tab</P> 추첨경품 <P>Get</P></> },
];

export default function GameRulesModal({ open, onStart }) {
  const { mode } = useViewMode();
  const isTV = mode === 'tv';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Enter') onStart(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onStart]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 bg-black/10 z-50 flex items-center justify-center">
      <div
        className={`rounded-3xl ${isTV ? 'px-[61px] py-[53px] w-[520px]' : 'px-[38px] py-[37px] w-[250px]'}`}
        style={{
          background: 'rgba(18, 18, 24, 0.50)',
          backdropFilter: 'blur(2px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-full h-px bg-white/15 mb-4" />
          <p className={`${isTV ? 'text-sm' : 'text-[10px]'} font-semibold tracking-[0.3em] uppercase text-white/40 mb-1`}>How to play</p>
          <h2 className={`${isTV ? 'text-3xl' : 'text-lg'} font-black text-white tracking-tight`}>Game Rules</h2>
          <div
            className="mt-2 h-[1.5px] w-10 rounded-full"
            style={{ background: `linear-gradient(to right, transparent, ${BRAND}, transparent)` }}
          />
          <div className="w-full h-px bg-white/15 mt-4" />
        </div>

        {/* 규칙 목록 */}
        <ul className={`flex flex-col ${isTV ? 'gap-5 mb-9' : 'gap-3.5 mb-7'} ${isTV ? '' : 'pl-3'}`}>
          {rules.map(({ text, node }, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 ${isTV ? 'w-6 h-6 text-xs' : 'w-4 h-4 text-[9px]'} rounded-full flex items-center justify-center font-black flex-shrink-0`}
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                {i + 1}
              </span>
              <span className={`text-white/75 ${isTV ? 'text-xl' : 'text-[13px]'} leading-snug`}>{node ?? text}</span>
            </li>
          ))}
        </ul>

        {/* 버튼 */}
        <div className="w-full h-px bg-white/15 mb-5" />
        <div className="flex justify-center">
          <button
            onClick={onStart}
            className="group relative overflow-hidden rounded-2xl transition-all duration-200 active:scale-95"
          >
            <div
              className="absolute -inset-0.5 rounded-2xl blur-sm opacity-60 group-hover:opacity-90 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${BRAND}, #ff4d88)` }}
            />
            <div
              className={`relative ${isTV ? 'px-16 py-4 text-xl' : 'px-9 py-2.5 text-sm'} rounded-2xl text-white font-bold tracking-wide`}
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #c4084e 100%)` }}
            >
              시작하기
            </div>
          </button>
        </div>
        <div className="w-full h-px bg-white/15 mt-5" />
      </div>
    </div>
  );
}
