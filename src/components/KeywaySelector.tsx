import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { inToMm, KEYWAY_PRESETS } from '../domain/keyways';
import type { KeywaySpec } from '../domain/types';

interface KeywaySelectorProps {
  selectedSpec: KeywaySpec;
  isCustomMode: boolean;
  onSelectPreset: (spec: KeywaySpec) => void;
  onToggleCustomMode: () => void;
}

export function KeywaySelector({
  selectedSpec,
  isCustomMode,
  onSelectPreset,
  onToggleCustomMode,
}: KeywaySelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KEYWAY_PRESETS;
    return KEYWAY_PRESETS.filter(
      (k) =>
        k.code.toLowerCase().includes(q) ||
        k.name.toLowerCase().includes(q) ||
        k.manufacturer.toLowerCase().includes(q) ||
        k.ilcoRef.toLowerCase().includes(q) ||
        k.dsdRef.toLowerCase().includes(q) ||
        k.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          Keyway Standard (DSD)
        </span>
        <button
          type="button"
          onClick={onToggleCustomMode}
          data-testid="custom-keyway-toggle"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
            isCustomMode
              ? 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/40 dark:text-amber-400'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Custom DSD
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          data-testid="keyway-selector-trigger"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition hover:border-amber-500/60 dark:border-zinc-700/80 dark:bg-zinc-950/80"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                {selectedSpec.code}
              </span>
              <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {selectedSpec.name}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
              {selectedSpec.pinCount}-pin · Depths {selectedSpec.depthMin}–{selectedSpec.depthMax} ·{' '}
              {selectedSpec.dsdRef}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div
            data-testid="keyway-dropdown"
            className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                data-testid="keyway-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search WR5, KW1, SC1, Yale, Master, Sargent, Arrow..."
                autoFocus
                className="w-full bg-transparent text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none dark:text-zinc-100"
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-zinc-500">
                  No matching keyway preset.
                </div>
              ) : (
                filtered.map((spec) => {
                  const active = !isCustomMode && spec.id === selectedSpec.id;
                  return (
                    <button
                      key={spec.id}
                      type="button"
                      data-testid={`keyway-option-${spec.id}`}
                      onClick={() => {
                        onSelectPreset(spec);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                        active
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold">{spec.code}</span>
                          <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                            {spec.manufacturer}
                          </span>
                          <span className="rounded bg-zinc-200/70 px-1 py-0.2 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Ilco {spec.ilcoRef}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {spec.pinCount}P · 1st {spec.firstCutIn.toFixed(3)}&quot; · Δ{spec.pinSpacingIn.toFixed(3)}
                          &quot; · Step {spec.depthStepIn.toFixed(4)}&quot;
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-zinc-200 px-1.5 py-0.5 text-[10px] capitalize text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        {spec.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Compact Verified DSD Spec Strip */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-lg bg-zinc-100/80 p-2 font-mono text-[10px] dark:bg-zinc-950/60">
        <div>
          <span className="block text-zinc-500">1st / Space</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {selectedSpec.firstCutIn.toFixed(3)}&quot; / {selectedSpec.pinSpacingIn.toFixed(3)}&quot;
          </span>
        </div>
        <div>
          <span className="block text-zinc-500">Depth Step</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {selectedSpec.depthStepIn.toFixed(4)}&quot; ({inToMm(selectedSpec.depthStepIn).toFixed(2)}mm)
          </span>
        </div>
        <div>
          <span className="block text-zinc-500">Blade / MACS</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {inToMm(selectedSpec.bladeWidthIn).toFixed(2)}mm · M{selectedSpec.macs}
          </span>
        </div>
      </div>
    </section>
  );
}
