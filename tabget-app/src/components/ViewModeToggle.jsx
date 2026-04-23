import { useViewMode } from '../ViewModeContext';

export default function ViewModeToggle({ size = 'md' }) {
  const { mode, toggle } = useViewMode();
  const isTV = mode === 'tv';
  const base = size === 'sm'
    ? 'text-[10px] px-2 py-1 gap-1 rounded-lg'
    : 'text-xs px-3 py-1.5 gap-1.5 rounded-xl';

  return (
    <button
      onClick={toggle}
      className={`flex items-center ${base} bg-black/40 backdrop-blur-md border border-white/20 text-white/80 hover:text-white hover:bg-black/60 transition-all select-none`}
    >
      <span className={isTV ? 'opacity-40' : 'opacity-100'}>📱 Phone</span>
      <span className="text-white/30 mx-0.5">|</span>
      <span className={isTV ? 'opacity-100' : 'opacity-40'}>📺 TV</span>
    </button>
  );
}
