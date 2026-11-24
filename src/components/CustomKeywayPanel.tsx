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
    setBladeWidth(String(fmt(Number.parseFloat(bladeWidth) || 0.318)));
    setBladeLength(String(fmt(Number.parseFloat(bladeLength) || 1.09)));
    setBladeThickness(String(fmt(Number.parseFloat(bladeThickness) || 0.082)));
    setCutFlat(String(fmt(Number.parseFloat(cutFlat) || 0.06)));
    setUnit(nextUnit);
  };

  const handleApply = () => {
    const spaces = parseNumberList(spacesText);
    const rootDepths = parseNumberList(depthsText);
    if (spaces.length < 2 || rootDepths.length < 2) {
      setError('Need at least 2 spaces and 2 depths.');
      return;
    }
    setError(null);
    onApply({
      name: name.trim() || 'Custom',
      unit,
      spaces,
      rootDepths,
      depthMin: Number.parseInt(depthMin, 10) || 0,
      bladeWidth: Number.parseFloat(bladeWidth) || (unit === 'mm' ? 8.1 : 0.318),
      bladeLength: Number.parseFloat(bladeLength) || (unit === 'mm' ? 27.5 : 1.09),
      bladeThickness: Number.parseFloat(bladeThickness) || (unit === 'mm' ? 2.1 : 0.082),
      cutFlat: Number.parseFloat(cutFlat) || (unit === 'mm' ? 1.5 : 0.06),
      cutAngleDeg: Number.parseFloat(cutAngleDeg) || 90,
      macs: Number.parseInt(macs, 10) || 6,
    });
  };

  const fieldCls =
    'w-full rounded-lg bg-black/[0.05] px-2.5 py-1.5 font-mono text-xs text-[#1d1d1f] focus:ring-2 focus:ring-[#007aff]/40 focus:outline-none dark:bg-white/[0.08] dark:text-white';

  return (
    <div data-testid="custom-keyway-panel" className="mt-2.5 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className={fieldCls}
        />
        <div className="inline-flex shrink-0 rounded-lg bg-black/[0.06] p-0.5 dark:bg-white/[0.1]">
          {(['in', 'mm'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleUnitSwitch(u)}
              className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                unit === u
                  ? 'bg-white font-semibold text-black shadow-xs dark:bg-[#3a3a3c] dark:text-white'
                  : 'text-black/55 dark:text-white/55'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        data-testid="custom-spaces-input"
        aria-label={`Spaces (${unit})`}
        placeholder={`Spaces (${unit})`}
        value={spacesText}
        onChange={(e) => setSpacesText(e.target.value)}
        className={fieldCls}
      />

      <input
        type="text"
        data-testid="custom-depths-input"
        aria-label={`Depths (${unit})`}
        placeholder={`Root depths (${unit})`}
        value={depthsText}
        onChange={(e) => setDepthsText(e.target.value)}
        className={fieldCls}
      />

      <div className="grid grid-cols-3 gap-1.5">
        <input type="number" step="any" value={bladeWidth} onChange={(e) => setBladeWidth(e.target.value)} placeholder="Width" aria-label="Width" className={fieldCls} />
        <input type="number" step="any" value={bladeLength} onChange={(e) => setBladeLength(e.target.value)} placeholder="Length" aria-label="Length" className={fieldCls} />
        <input type="number" step="any" value={bladeThickness} onChange={(e) => setBladeThickness(e.target.value)} placeholder="Thick" aria-label="Thickness" className={fieldCls} />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <input type="number" value={depthMin} onChange={(e) => setDepthMin(e.target.value)} placeholder="Min" aria-label="Min depth" className={fieldCls} />
        <input type="number" step="any" value={cutFlat} onChange={(e) => setCutFlat(e.target.value)} placeholder="Flat" aria-label="Flat" className={fieldCls} />
        <input type="number" value={cutAngleDeg} onChange={(e) => setCutAngleDeg(e.target.value)} placeholder="Angle" aria-label="Angle" className={fieldCls} />
        <input type="number" value={macs} onChange={(e) => setMacs(e.target.value)} placeholder="MACS" aria-label="MACS" className={fieldCls} />
      </div>

      {error && <p className="text-[11px] text-[#ff3b30]">{error}</p>}

      <button
        type="button"
        data-testid="apply-custom-keyway"
        onClick={handleApply}
        className="w-full rounded-lg bg-[#007aff] py-1.5 text-xs font-medium text-white transition hover:bg-[#0066d6]"
      >
        Apply
      </button>
    </div>
  );
}
