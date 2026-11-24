import type { Theme } from '../hooks/useTheme';

export type AppMode = 'decode' | 'screen' | 'preview3d';

interface HeaderProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const MODES: readonly { id: AppMode; label: string; testId: string }[] = [
  { id: 'decode', label: 'Photo', testId: 'tab-decode' },
  { id: 'screen', label: '1:1', testId: 'tab-screen' },
  { id: 'preview3d', label: '3D', testId: 'tab-3d' },
];

export function Header({ mode, onChangeMode, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-black/8 bg-white/90 px-3 backdrop-blur-md sm:px-4 dark:border-white/10 dark:bg-[#1c1c1e]/90">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          Key Decoder
        </span>
        <span
          data-testid="privacy-badge"
          title="100% local in browser memory — photos never leave your device"
          className="hidden text-[11px] text-black/45 sm:inline dark:text-white/45"
        >
          On-device
        </span>
      </div>

      {/* Apple Segmented Control */}
      <nav
        aria-label="Mode"
        className="inline-flex rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]"
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-testid={m.testId}
              onClick={() => onChangeMode(m.id)}
              className={`rounded-[6px] px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.12)] dark:bg-[#3a3a3c] dark:text-white'
                  : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onToggleTheme}
        data-testid="theme-toggle"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="rounded-lg px-2 py-1 text-xs font-medium text-black/60 transition hover:bg-black/[0.05] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white"
      >
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </header>
  );
}
