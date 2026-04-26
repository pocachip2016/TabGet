import { useViewMode } from '../ViewModeContext';

export default function ViewModeToggle({ size = 'md' }) {
  const { mode, toggle } = useViewMode();
  const isTV = mode === 'tv';

  const outer = size === 'sm'
    ? 'p-0.5 rounded-xl gap-0.5'
    : size === 'lg'
    ? 'p-1 rounded-2xl gap-1'
    : 'p-0.5 rounded-xl gap-0.5';

  const pill = size === 'sm'
    ? 'px-2.5 py-0.5 rounded-lg text-[11px] font-semibold'
    : size === 'lg'
    ? 'px-6 py-2.5 rounded-xl text-lg font-bold'
    : 'px-3 py-1 rounded-lg text-xs font-semibold';

  return (
    <button
      onClick={toggle}
      className={`flex items-center ${outer} bg-zinc-800/80 backdrop-blur-md border border-white/10 select-none`}
    >
      <span className={`${pill} transition-all duration-200 ${!isTV ? 'bg-white text-zinc-900' : 'text-white/35'}`}>
        📱 Phone
      </span>
      <span className={`${pill} transition-all duration-200 ${isTV ? 'bg-white text-zinc-900' : 'text-white/35'}`}>
        📺 TV
      </span>
    </button>
  );
}
