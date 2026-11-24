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
      // ignore in non-secure contexts
    }
    setCopied('code');
    window.setTimeout(() => setCopied(null), 1400);
  };

  const handleCopyLink = () => {
    onCopyShareLink();
    setCopied('link');
    window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <div className="space-y-3">
      {/* Code readout + simple actions */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Bitting</div>
          <div
            data-testid="bitting-code-display"
            className="font-mono text-xl font-bold tracking-wider text-zinc-900 dark:text-zinc-100"
          >
            {bittingStr}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCode}
            data-testid="copy-bitting-btn"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copied === 'code' ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            data-testid="share-link-btn"
            title="Copy URL hash with keyway and bitting"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copied === 'link' ? 'Copied' : 'Link'}
          </button>
          <button
            type="button"
            onClick={onResetCuts}
            title="Reset cuts"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Only show MACS warning when actually violated */}
      {macsViolations.length > 0 && (
        <div
          data-testid="macs-warning"
          className="rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          Exceeds MACS ({spec.macs}) between{' '}
          {macsViolations.map((v) => `pin ${v.pinIndexA + 1}–${v.pinIndexB + 1}`).join(', ')}.
        </div>
      )}

      {/* Clean, flat 1-line-per-pin controls */}
      <div className="space-y-2">
        {cuts.map((depth, idx) => {
          const isBad = violatedPins.has(idx);
          const isFocused = activePinIndex === idx;
          return (
            <div
              key={idx}
              data-testid={`pin-row-${idx + 1}`}
              onMouseEnter={() => onSelectPin(idx)}
              onMouseLeave={() => onSelectPin(null)}
              className={`flex items-center gap-2 rounded py-0.5 ${
                isFocused ? 'bg-zinc-100/80 dark:bg-zinc-900' : ''
              }`}
            >
              <span className="w-6 font-mono text-xs text-zinc-500">#{idx + 1}</span>

              <button
                type="button"
                data-testid={`pin-${idx + 1}-dec`}
                aria-label={`Decrease pin ${idx + 1}`}
                disabled={depth <= spec.depthMin}
                onClick={() => onChangeCut(idx, depth - 1)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white font-mono text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                −
              </button>

              <span
                data-testid={`pin-${idx + 1}-value`}
                className={`w-5 text-center font-mono text-sm font-semibold ${
                  isBad ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white font-mono text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                +
              </button>

              <input
                type="range"
                data-testid={`pin-${idx + 1}-slider`}
                aria-label={`Pin ${idx + 1} depth`}
                min={spec.depthMin}
                max={spec.depthMax}
                step={1}
                value={depth}
                onChange={(e) => onChangeCut(idx, Number.parseInt(e.target.value, 10))}
                className="h-1.5 flex-1 cursor-pointer accent-blue-600"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
