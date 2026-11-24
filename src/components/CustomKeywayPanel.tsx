import { Check } from 'lucide-react';
import { useState } from 'react';
import type { CustomKeywayInput } from '../domain/types';

interface CustomKeywayPanelProps {
  initialInput: CustomKeywayInput;
  onApply: (input: CustomKeywayInput) => void;
}

function parseNumberList(raw: string): number[] {
  return raw
    .split(/[,\s;]+/)
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function CustomKeywayPanel({ initialInput, onApply }: CustomKeywayPanelProps) {
  const [name, setName] = useState(initialInput.name);
  const [unit, setUnit] = useState<'in' | 'mm'>(initialInput.unit);
  const [spacesText, setSpacesText] = useState(initialInput.spaces.join(', '));
  const [depthsText, setDepthsText] = useState(initialInput.rootDepths.join(', '));
  const [depthMin, setDepthMin] = useState(String(initialInput.depthMin));
  const [bladeWidth, setBladeWidth] = useState(String(initialInput.bladeWidth));
  const [bladeLength, setBladeLength] = useState(String(initialInput.bladeLength));
  const [bladeThickness, setBladeThickness] = useState(String(initialInput.bladeThickness));
  const [cutFlat, setCutFlat] = useState(String(initialInput.cutFlat));
  const [cutAngleDeg, setCutAngleDeg] = useState(String(initialInput.cutAngleDeg));
  const [macs, setMacs] = useState(String(initialInput.macs));
  const [error, setError] = useState<string | null>(null);

  const handleUnitSwitch = (nextUnit: 'in' | 'mm') => {
    if (nextUnit === unit) return;
    const factor = nextUnit === 'mm' ? 25.4 : 1 / 25.4;
    const fmt = (v: number) => Number((v * factor).toFixed(nextUnit === 'mm' ? 2 : 4));

    const sp = parseNumberList(spacesText).map(fmt);
    const dp = parseNumberList(depthsText).map(fmt);
    setSpacesText(sp.join(', '));
    setDepthsText(dp.join(', '));
    setBladeWidth(String(fmt(Number.parseFloat(bladeWidth) || 0.335)));
    setBladeLength(String(fmt(Number.parseFloat(bladeLength) || 1.075)));
    setBladeThickness(String(fmt(Number.parseFloat(bladeThickness) || 0.082)));
    setCutFlat(String(fmt(Number.parseFloat(cutFlat) || 0.045)));
    setUnit(nextUnit);
  };

  const handleApply = () => {
    const spaces = parseNumberList(spacesText);
    const rootDepths = parseNumberList(depthsText);
    if (spaces.length < 2) {
      setError('Enter at least 2 pin spacing values.');
      return;
    }
    if (rootDepths.length < 2) {
      setError('Enter at least 2 root depth values.');
      return;
    }
    setError(null);
    onApply({
      name: name.trim() || 'Custom Keyway',
      unit,
      spaces,
      rootDepths,
      depthMin: Number.parseInt(depthMin, 10) || 0,
      bladeWidth: Number.parseFloat(bladeWidth) || (unit === 'mm' ? 8.5 : 0.335),
      bladeLength: Number.parseFloat(bladeLength) || (unit === 'mm' ? 27.3 : 1.075),
      bladeThickness: Number.parseFloat(bladeThickness) || (unit === 'mm' ? 2.1 : 0.082),
      cutFlat: Number.parseFloat(cutFlat) || (unit === 'mm' ? 1.1 : 0.045),
      cutAngleDeg: Number.parseFloat(cutAngleDeg) || 90,
      macs: Number.parseInt(macs, 10) || 6,
    });
  };

  return (
    <section
      data-testid="custom-keyway-panel"
      className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 dark:bg-amber-500/10"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-400">
          Custom Keyway Parameters
        </span>
        <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => handleUnitSwitch('in')}
            className={`rounded px-2 py-0.5 font-mono font-semibold ${
              unit === 'in'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            inches
          </button>
          <button
            type="button"
            onClick={() => handleUnitSwitch('mm')}
            className={`rounded px-2 py-0.5 font-mono font-semibold ${
              unit === 'mm'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            mm
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
            Pin Spaces from Shoulder ({unit}, comma-separated)
          </label>
          <input
            type="text"
            data-testid="custom-spaces-input"
            value={spacesText}
            onChange={(e) => setSpacesText(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-0.5 block text-[11px] text-zinc-600 dark:text-zinc-400">
            Root Depths Shallow→Deep ({unit}, comma-separated)
          </label>
          <input
            type="text"
            data-testid="custom-depths-input"
            value={depthsText}
            onChange={(e) => setDepthsText(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">
              Blade Width ({unit})
            </label>
            <input
              type="number"
              step="any"
              value={bladeWidth}
              onChange={(e) => setBladeWidth(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">
              Length ({unit})
            </label>
            <input
              type="number"
              step="any"
              value={bladeLength}
              onChange={(e) => setBladeLength(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">
              Thickness ({unit})
            </label>
            <input
              type="number"
              step="any"
              value={bladeThickness}
              onChange={(e) => setBladeThickness(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">Start #</label>
            <input
              type="number"
              value={depthMin}
              onChange={(e) => setDepthMin(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">Flat ({unit})</label>
            <input
              type="number"
              step="any"
              value={cutFlat}
              onChange={(e) => setCutFlat(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">Angle °</label>
            <input
              type="number"
              value={cutAngleDeg}
              onChange={(e) => setCutAngleDeg(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] text-zinc-600 dark:text-zinc-400">MACS</label>
            <input
              type="number"
              value={macs}
              onChange={(e) => setMacs(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>

        {error && <p className="text-[11px] font-medium text-red-500">{error}</p>}

        <button
          type="button"
          data-testid="apply-custom-keyway"
          onClick={handleApply}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
        >
          <Check className="h-3.5 w-3.5" />
          Apply Custom Keyway
        </button>
      </div>
    </section>
  );
}
