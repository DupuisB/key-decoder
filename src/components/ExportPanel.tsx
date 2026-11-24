import { useState } from 'react';
import { formatBittingCode } from '../domain/bitting';
import { inToMm } from '../domain/keyways';
import type { KeywaySpec, PrintOptions } from '../domain/types';

interface ExportPanelProps {
  spec: KeywaySpec;
  cuts: readonly number[];
  printOptions: PrintOptions;
  onChangePrintOptions: (next: PrintOptions) => void;
  onDownloadStl: () => void;
}

export function ExportPanel({
  spec,
  cuts,
  printOptions,
  onChangePrintOptions,
  onDownloadStl,
}: ExportPanelProps) {
  const [showOptions, setShowOptions] = useState(false);

  const fileName = `${spec.code.replace(/[^A-Za-z0-9_-]/g, '')}-${formatBittingCode(cuts, '')}.stl`;
  const effectiveThickMm = inToMm(spec.bladeThicknessIn) * printOptions.bladeThicknessScale;

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        data-testid="download-stl-btn"
        onClick={onDownloadStl}
        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
      >
        Download {fileName}
      </button>

      <button
        type="button"
        data-testid="print-options-toggle"
        onClick={() => setShowOptions((s) => !s)}
        className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {showOptions ? 'Hide print options' : 'Print options & tips'}
      </button>

      {showOptions && (
        <div
          data-testid="print-options-box"
          className="space-y-2.5 rounded border border-zinc-200 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <div>
            <div className="mb-1 flex justify-between text-zinc-700 dark:text-zinc-300">
              <label htmlFor="thickness-scale">Blade thickness</label>
              <span className="font-mono">
                {Math.round(printOptions.bladeThicknessScale * 100)}% ({effectiveThickMm.toFixed(2)} mm)
              </span>
            </div>
            <input
              id="thickness-scale"
              data-testid="thickness-scale-slider"
              type="range"
              min={0.9}
              max={1.05}
              step={0.01}
              value={printOptions.bladeThicknessScale}
              onChange={(e) =>
                onChangePrintOptions({
                  ...printOptions,
                  bladeThicknessScale: Number.parseFloat(e.target.value),
                })
              }
              className="h-1.5 w-full cursor-pointer accent-blue-600"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              data-testid="reinforced-bow-toggle"
              checked={printOptions.reinforcedBow}
              onChange={(e) =>
                onChangePrintOptions({ ...printOptions, reinforcedBow: e.target.checked })
              }
              className="accent-blue-600"
            />
            Reinforced bow (+0.8 mm)
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              data-testid="warding-grooves-toggle"
              checked={printOptions.includeWarding}
              onChange={(e) =>
                onChangePrintOptions({ ...printOptions, includeWarding: e.target.checked })
              }
              className="accent-blue-600"
            />
            Warding grooves
          </label>

          <p className="border-t border-zinc-200 pt-2 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Print flat on bed (Z=0), 100% infill / all walls, PLA+/PETG/Nylon. Emergency backup use only.
          </p>
        </div>
      )}
    </div>
  );
}
