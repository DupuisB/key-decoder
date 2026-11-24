import { KeyRound, Moon, ShieldCheck, Sun } from 'lucide-react';
import type { Theme } from '../hooks/useTheme';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="relative z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-zinc-950 shadow-sm">
            <KeyRound className="h-4.5 w-4.5 stroke-[2.2]" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-900 sm:text-base dark:text-zinc-100">
              Key Decoder
            </h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block dark:text-zinc-400">
              Visual Pin-Tumbler DSD Decoder &amp; Watertight 3D STL Generator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            data-testid="privacy-badge"
            title="All photo alignment, bitting math, and 3D STL mesh generation execute strictly inside your browser's local memory. Zero uploads, zero telemetry, 100% offline-capable."
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden md:inline">100% Local in Browser Memory · Photos Never Leave Your Device</span>
            <span className="md:hidden">100% Local · Offline</span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
