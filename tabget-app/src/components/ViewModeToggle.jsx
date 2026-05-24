import { useViewMode } from '../ViewModeContext';

export default function ViewModeToggle({ size = 'md' }) {
  const { mode, setMode } = useViewMode();
  const isTV = mode === 'tv';

  const outer = size === 'sm'
    ? 'p-0.5 rounded-xl gap-0.5'
    : size === 'lg'
    ? 'p-1.5 rounded-2xl gap-1.5'
    : 'p-0.5 rounded-xl gap-0.5';

  const pill = size === 'sm'
    ? 'px-2.5 py-0.5 rounded-lg text-[11px] font-semibold'
    : size === 'lg'
    ? 'px-12 py-5 rounded-xl text-2xl font-bold'
    : 'px-3 py-1 rounded-lg text-xs font-semibold';

  const layout = size === 'lg' ? 'flex flex-col items-stretch' : 'flex items-center';

  return (
    <div className={`${layout} ${outer} bg-zinc-800/80 backdrop-blur-md border border-white/10 select-none`}>
      <button
        onClick={() => setMode('phone')}
        className={`${pill} transition-all duration-200 ${!isTV ? 'bg-white text-zinc-900' : 'text-white/35'}`}
      >
        📱 Phone화면보기
      </button>
      <button
        onClick={() => setMode('tv')}
        className={`${pill} transition-all duration-200 ${isTV ? 'bg-white text-zinc-900' : 'text-white/35'}`}
      >
        📺 TV화면보기
      </button>
    </div>
  );
}
