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
        className="h-10 w-full rounded-xl bg-[#007aff] px-4 text-sm font-semibold text-white transition hover:bg-[#0066d6] active:scale-[0.99] dark:bg-[#0a84ff] dark:hover:bg-[#0071e3]"
      >
        Download {fileName}
      </button>

      <div className="flex justify-center">
        <button
          type="button"
          data-testid="print-options-toggle"
          onClick={() => setShowOptions((s) => !s)}
          className="text-xs font-medium text-black/45 transition hover:text-black dark:text-white/45 dark:hover:text-white"
        >
          {showOptions ? 'Hide print options' : 'Print options'}
        </button>
      </div>

      {showOptions && (
        <div
          data-testid="print-options-box"
          className="space-y-3 rounded-xl bg-black/[0.04] p-3 text-xs dark:bg-white/[0.06]"
        >
          <div>
            <div className="mb-1.5 flex justify-between text-black/70 dark:text-white/75">
              <label htmlFor="thickness-scale">Thickness</label>
              <span className="font-mono tabular-nums">
                {Math.round(printOptions.bladeThicknessScale * 100)}% · {effectiveThickMm.toFixed(2)} mm
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
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-black/75 dark:text-white/80">
              <input
                type="checkbox"
                data-testid="reinforced-bow-toggle"
                checked={printOptions.reinforcedBow}
                onChange={(e) =>
                  onChangePrintOptions({ ...printOptions, reinforcedBow: e.target.checked })
                }
                className="accent-[#007aff]"
              />
              Thick bow
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-black/75 dark:text-white/80">
              <input
                type="checkbox"
                data-testid="warding-grooves-toggle"
                checked={printOptions.includeWarding}
                onChange={(e) =>
                  onChangePrintOptions({ ...printOptions, includeWarding: e.target.checked })
                }
                className="accent-[#007aff]"
              />
              Grooves
            </label>
          </div>

          <p className="text-[11px] text-black/45 dark:text-white/45">
            Flat on bed (Z=0) · 100% infill · PLA+/PETG/Nylon · Backup use only.
          </p>
        </div>
      )}
    </div>
  );
}
