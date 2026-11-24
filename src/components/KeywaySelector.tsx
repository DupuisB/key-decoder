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
    <div className="flex items-center gap-2">
      {!isCustomMode ? (
        <select
          aria-label="Keyway"
          data-testid="keyway-select"
          value={selectedSpec.id}
          onChange={(e) => {
            const found = KEYWAY_PRESETS.find((k) => k.id === e.target.value);
            if (found) onSelectPreset(found);
          }}
          className="h-9 min-w-0 flex-1 rounded-lg bg-black/[0.05] px-2.5 text-[13px] font-medium text-[#1d1d1f] focus:ring-2 focus:ring-[#007aff]/40 focus:outline-none dark:bg-white/[0.09] dark:text-[#f5f5f7]"
        >
          {KEYWAY_PRESETS.map((k) => (
            <option key={k.id} value={k.id} className="bg-white text-black dark:bg-[#1c1c1e] dark:text-white">
              {k.code} · {k.manufacturer}
            </option>
          ))}
        </select>
      ) : (
        <span className="flex-1 text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
          {selectedSpec.name}
        </span>
      )}

      <button
        type="button"
        onClick={onToggleCustomMode}
        data-testid="custom-keyway-toggle"
        className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-[#007aff] transition hover:bg-[#007aff]/10 dark:text-[#0a84ff]"
      >
        {isCustomMode ? 'Presets' : 'Custom'}
      </button>
    </div>
  );
}
