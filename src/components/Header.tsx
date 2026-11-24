import type { Theme } from '../hooks/useTheme';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Key Decoder</h1>
          <span
            data-testid="privacy-badge"
            title="All photo alignment, decoding, and STL generation run locally in your browser. Photos never leave your device."
            className="text-xs text-zinc-500 dark:text-zinc-400"
          >
            Local only — photos stay on your device
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          data-testid="theme-toggle"
          className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
