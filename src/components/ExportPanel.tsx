import { Download, Info, Layers } from 'lucide-react';
import { useState } from 'react';
import { formatBittingCode } from '../domain/bitting';
import { inToMm } from '../domain/keyways';
import type { KeywaySpec, PrintOptions } from '../domain/types';
import type { ManifoldMesh } from '../geometry/keyMesh';

interface ExportPanelProps {
  spec: KeywaySpec;
  cuts: readonly number[];
  printOptions: PrintOptions;
  mesh: ManifoldMesh;
  onChangePrintOptions: (next: PrintOptions) => void;
  onDownloadStl: () => void;
}

export function ExportPanel({
  spec,
  cuts,
  printOptions,
  mesh,
  onChangePrintOptions,
  onDownloadStl,
}: ExportPanelProps) {
  const [showAdvisory, setShowAdvisory] = useState(false);

  const fileName = `${spec.code.replace(/[^A-Za-z0-9_-]/g, '')}-${formatBittingCode(cuts, '')}.stl`;
  const effectiveBladeThickMm = inToMm(spec.bladeThicknessIn) * printOptions.bladeThicknessScale;
  const totalLenMm = mesh.bounds.maxX - mesh.bounds.minX;
  const totalHeightMm = mesh.bounds.maxY - mesh.bounds.minY;
  const totalThickMm = mesh.bounds.maxZ - mesh.bounds.minZ;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            3D Print Tolerances &amp; Export
          </span>
        </div>

        <button
          type="button"
          data-testid="printing-advisory-toggle"
          onClick={() => setShowAdvisory((s) => !s)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-400"
        >
          <Info className="h-3.5 w-3.5" />
          3D Print Advisory
        </button>
      </div>

      {showAdvisory && (
        <div
          data-testid="printing-advisory-box"
          className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200"
        >
          <p className="font-semibold">Recommended FDM Slicer Settings:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>
              <strong>Orientation:</strong> STL exports flat on the build plate (<code>Z = 0</code>), zero supports needed.
            </li>
            <li>
              <strong>Strength:</strong> 100% infill or all perimeters/walls, 0.12–0.16 mm layer height.
            </li>
            <li>
              <strong>Filament:</strong> PLA+, PETG, or Nylon (avoid brittle standard matte PLA).
            </li>
            <li>
              <strong>Safety Notice:</strong> Plastic keys are for emergency backup / test fitting only—do not force in stiff cylinders.
            </li>
          </ul>
        </div>
      )}

      {/* Blade Thickness Scale Slider */}
      <div className="space-y-2.5 text-xs">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="thickness-scale" className="text-zinc-700 dark:text-zinc-300">
              Blade Thickness Scale
            </label>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {Math.round(printOptions.bladeThicknessScale * 100)}% ({effectiveBladeThickMm.toFixed(2)} mm)
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
          <div className="mt-0.5 flex justify-between font-mono text-[10px] text-zinc-400">
            <span>90% (Loose)</span>
            <span>98% (FDM Rec.)</span>
            <span>105% (Tight)</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Reinforced Bow</span>
            <input
              type="checkbox"
              data-testid="reinforced-bow-toggle"
              checked={printOptions.reinforcedBow}
              onChange={(e) =>
                onChangePrintOptions({
                  ...printOptions,
                  reinforcedBow: e.target.checked,
                })
              }
              className="h-4 w-4 rounded accent-amber-500"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Warding Grooves</span>
            <input
              type="checkbox"
              data-testid="warding-grooves-toggle"
              checked={printOptions.includeWarding}
              onChange={(e) =>
                onChangePrintOptions({
                  ...printOptions,
                  includeWarding: e.target.checked,
                })
              }
              className="h-4 w-4 rounded accent-amber-500"
            />
          </label>
        </div>

        {/* Live Manifold Mesh Readout */}
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-zinc-100/80 px-2.5 py-1.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-950/60 dark:text-zinc-400">
          <span>
            {totalLenMm.toFixed(1)} × {totalHeightMm.toFixed(1)} × {totalThickMm.toFixed(2)} mm
          </span>
          <span>{mesh.triangleCount.toLocaleString()} tris · Watertight</span>
        </div>

        {/* Primary Download STL CTA */}
        <button
          type="button"
          data-testid="download-stl-btn"
          onClick={onDownloadStl}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-amber-400 active:scale-[0.99]"
        >
          <Download className="h-4 w-4 stroke-[2.4]" />
          Download {fileName}
        </button>
      </div>
    </section>
  );
}
