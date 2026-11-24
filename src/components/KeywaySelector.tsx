import { KEYWAY_PRESETS } from '../domain/keyways';
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
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="keyway-select"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Keyway
        </label>
        <button
          type="button"
          onClick={onToggleCustomMode}
          data-testid="custom-keyway-toggle"
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {isCustomMode ? 'Use preset' : 'Custom'}
        </button>
      </div>

      {!isCustomMode && (
        <select
          id="keyway-select"
          data-testid="keyway-select"
          value={selectedSpec.id}
          onChange={(e) => {
            const found = KEYWAY_PRESETS.find((k) => k.id === e.target.value);
            if (found) onSelectPreset(found);
          }}
          className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {KEYWAY_PRESETS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.code} — {k.manufacturer} ({k.pinCount}-pin, {k.depthMin}–{k.depthMax})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
