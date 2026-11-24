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

    setSpacesText(parseNumberList(spacesText).map(fmt).join(', '));
    setDepthsText(parseNumberList(depthsText).map(fmt).join(', '));
    setBladeWidth(String(fmt(Number.parseFloat(bladeWidth) || 0.335)));
    setBladeLength(String(fmt(Number.parseFloat(bladeLength) || 1.075)));
    setBladeThickness(String(fmt(Number.parseFloat(bladeThickness) || 0.082)));
    setCutFlat(String(fmt(Number.parseFloat(cutFlat) || 0.045)));
    setUnit(nextUnit);
  };

  const handleApply = () => {
    const spaces = parseNumberList(spacesText);
    const rootDepths = parseNumberList(depthsText);
    if (spaces.length < 2 || rootDepths.length < 2) {
      setError('Enter at least 2 spaces and 2 root depths.');
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

  const inputCls =
    'w-full rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

  return (
    <div
      data-testid="custom-keyway-panel"
      className="space-y-2 rounded border border-zinc-300 bg-zinc-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Custom DSD</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => handleUnitSwitch('in')}
            className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
              unit === 'in'
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
            }`}
          >
            in
          </button>
          <button
            type="button"
            onClick={() => handleUnitSwitch('mm')}
            className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
              unit === 'mm'
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
            }`}
          >
            mm
          </button>
        </div>
      </div>

      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputCls} />

      <div>
        <label className="mb-0.5 block text-[11px] text-zinc-500">Spaces ({unit})</label>
        <input
          type="text"
          data-testid="custom-spaces-input"
          value={spacesText}
          onChange={(e) => setSpacesText(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <label className="mb-0.5 block text-[11px] text-zinc-500">Root depths shallow→deep ({unit})</label>
        <input
          type="text"
          data-testid="custom-depths-input"
          value={depthsText}
          onChange={(e) => setDepthsText(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="block text-[10px] text-zinc-500">Width</label>
          <input type="number" step="any" value={bladeWidth} onChange={(e) => setBladeWidth(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Length</label>
          <input type="number" step="any" value={bladeLength} onChange={(e) => setBladeLength(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Thick</label>
          <input type="number" step="any" value={bladeThickness} onChange={(e) => setBladeThickness(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="block text-[10px] text-zinc-500">Min #</label>
          <input type="number" value={depthMin} onChange={(e) => setDepthMin(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Flat</label>
          <input type="number" step="any" value={cutFlat} onChange={(e) => setCutFlat(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Angle°</label>
          <input type="number" value={cutAngleDeg} onChange={(e) => setCutAngleDeg(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">MACS</label>
          <input type="number" value={macs} onChange={(e) => setMacs(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        data-testid="apply-custom-keyway"
        onClick={handleApply}
        className="w-full rounded bg-zinc-900 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Apply Custom
      </button>
    </div>
  );
}
