import { useState } from 'react';
import { checkMacsViolations, formatBittingCode } from '../domain/bitting';
import type { KeywaySpec } from '../domain/types';

interface CutControlsProps {
  spec: KeywaySpec;
  cuts: readonly number[];
  activePinIndex: number | null;
  onSelectPin: (index: number | null) => void;
  onChangeCut: (pinIndex: number, nextDepth: number) => void;
  onResetCuts: () => void;
  onCopyShareLink: () => void;
}

export function CutControls({
  spec,
  cuts,
  activePinIndex,
  onSelectPin,
  onChangeCut,
  onResetCuts,
  onCopyShareLink,
}: CutControlsProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const bittingStr = formatBittingCode(cuts, '-');
  const macsViolations = checkMacsViolations(spec, cuts);
  const violatedPins = new Set<number>();
  for (const v of macsViolations) {
    violatedPins.add(v.pinIndexA);
    violatedPins.add(v.pinIndexB);
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(bittingStr);
    } catch {
      // ignore in restricted contexts
    }
    setCopied('code');
    window.setTimeout(() => setCopied(null), 1200);
  };

  const handleCopyLink = () => {
    onCopyShareLink();
    setCopied('link');
    window.setTimeout(() => setCopied(null), 1200);
  };

  const ghostBtn =
    'rounded-md px-2 py-1 text-xs font-medium text-black/55 transition hover:bg-black/[0.05] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.08] dark:hover:text-white';

  return (
    <div className="space-y-3">
      {/* Crisp bitting readout + minimal actions */}
      <div className="flex items-center justify-between gap-2">
        <div
          data-testid="bitting-code-display"
          className="whitespace-nowrap font-mono text-[19px] font-semibold tracking-wide tabular-nums text-[#1d1d1f] dark:text-[#f5f5f7]"
        >
          {bittingStr}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={handleCopyCode} data-testid="copy-bitting-btn" className={ghostBtn}>
            {copied === 'code' ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={handleCopyLink} data-testid="share-link-btn" className={ghostBtn}>
            {copied === 'link' ? 'Copied' : 'Link'}
          </button>
          <button type="button" onClick={onResetCuts} className={ghostBtn}>
            Reset
          </button>
        </div>
      </div>

      {macsViolations.length > 0 && (
        <div
          data-testid="macs-warning"
          className="rounded-lg bg-[#ff3b30]/10 px-2.5 py-1.5 text-xs font-medium text-[#ff3b30] dark:text-[#ff453a]"
        >
          MACS {spec.macs}: {macsViolations.map((v) => `${v.pinIndexA + 1}–${v.pinIndexB + 1}`).join(', ')}
        </div>
      )}

      {/* Tactile, borderless Apple-clean pin rows */}
      <div className="space-y-2.5">
        {cuts.map((depth, idx) => {
          const isBad = violatedPins.has(idx);
          const isFocused = activePinIndex === idx;
          return (
            <div
              key={idx}
              data-testid={`pin-row-${idx + 1}`}
              onMouseEnter={() => onSelectPin(idx)}
              onMouseLeave={() => onSelectPin(null)}
              className={`flex items-center gap-2.5 rounded-lg py-0.5 transition ${
                isFocused ? 'bg-black/[0.03] dark:bg-white/[0.04]' : ''
              }`}
            >
              <span className="w-4 text-center font-mono text-xs tabular-nums text-black/40 dark:text-white/40">
                {idx + 1}
              </span>

              <div className="inline-flex items-center rounded-lg bg-black/[0.05] p-0.5 dark:bg-white/[0.09]">
                <button
                  type="button"
                  data-testid={`pin-${idx + 1}-dec`}
                  aria-label={`Decrease pin ${idx + 1}`}
                  disabled={depth <= spec.depthMin}
                  onClick={() => onChangeCut(idx, depth - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-base leading-none text-[#1d1d1f] transition hover:bg-white active:scale-95 disabled:opacity-25 dark:text-white dark:hover:bg-white/15"
                >
                  −
                </button>
                <span
                  data-testid={`pin-${idx + 1}-value`}
                  className={`w-6 text-center font-mono text-sm font-semibold tabular-nums ${
                    isBad ? 'text-[#ff3b30]' : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                  }`}
                >
                  {depth}
                </span>
                <button
                  type="button"
                  data-testid={`pin-${idx + 1}-inc`}
                  aria-label={`Increase pin ${idx + 1}`}
                  disabled={depth >= spec.depthMax}
                  onClick={() => onChangeCut(idx, depth + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] text-base leading-none text-[#1d1d1f] transition hover:bg-white active:scale-95 disabled:opacity-25 dark:text-white dark:hover:bg-white/15"
                >
                  +
                </button>
              </div>

              <input
                type="range"
                data-testid={`pin-${idx + 1}-slider`}
                aria-label={`Pin ${idx + 1}`}
                min={spec.depthMin}
                max={spec.depthMax}
                step={1}
                value={depth}
                onChange={(e) => onChangeCut(idx, Number.parseInt(e.target.value, 10))}
                className="flex-1"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
