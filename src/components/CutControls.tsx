import { AlertTriangle, Check, CheckCircle2, Copy, Link2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { checkMacsViolations, formatBittingCode, getRootDepthIn, getRootDepthMm } from '../domain/bitting';
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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
      // Fallback ignored in non-secure test contexts
    }
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleCopyLink = () => {
    onCopyShareLink();
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1600);
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70">
      {/* Bitting Code Readout Bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-[11px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Decoded Bitting Code
          </span>
          <div
            data-testid="bitting-code-display"
            className="mt-0.5 font-mono text-2xl font-bold tracking-widest text-zinc-900 dark:text-amber-400"
          >
            {bittingStr}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCode}
            data-testid="copy-bitting-btn"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCode ? 'Copied' : 'Copy'}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            data-testid="share-link-btn"
            title="Copy URL hash with keyway & bitting code (no photo is shared)"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
            {copiedLink ? 'Hash Copied' : 'Hash'}
          </button>

          <button
            type="button"
            onClick={onResetCuts}
            title="Reset cuts to keyway default"
            className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* MACS Status Strip */}
      <div className="mb-3">
        {macsViolations.length === 0 ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Valid bitting · Within factory MACS ({spec.macs})
          </div>
        ) : (
          <div
            data-testid="macs-warning"
            className="flex items-start gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              MACS ({spec.macs}) exceeded between{' '}
              {macsViolations.map((v) => `Pin ${v.pinIndexA + 1}–${v.pinIndexB + 1} (Δ${v.delta})`).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Per-Pin Steppers + Discrete Sliders */}
      <div className="space-y-2">
        {cuts.map((depth, idx) => {
          const isFocused = activePinIndex === idx;
          const hasMacsWarn = violatedPins.has(idx);
          const rootMm = getRootDepthMm(spec, depth);
          const rootIn = getRootDepthIn(spec, depth);

          return (
            <div
              key={idx}
              onMouseEnter={() => onSelectPin(idx)}
              onMouseLeave={() => onSelectPin(null)}
              data-testid={`pin-row-${idx + 1}`}
              className={`rounded-lg border px-2.5 py-2 transition ${
                hasMacsWarn
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : isFocused
                    ? 'border-amber-500/60 bg-zinc-50 dark:bg-zinc-800/70'
                    : 'border-zinc-200/90 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-200 font-mono text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {rootMm.toFixed(2)} mm ({rootIn.toFixed(3)}&quot;)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid={`pin-${idx + 1}-dec`}
                    aria-label={`Decrease pin ${idx + 1} depth`}
                    disabled={depth <= spec.depthMin}
                    onClick={() => onChangeCut(idx, depth - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span
                    data-testid={`pin-${idx + 1}-value`}
                    className="w-7 text-center font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100"
                  >
                    {depth}
                  </span>
                  <button
                    type="button"
                    data-testid={`pin-${idx + 1}-inc`}
                    aria-label={`Increase pin ${idx + 1} depth`}
                    disabled={depth >= spec.depthMax}
                    onClick={() => onChangeCut(idx, depth + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-400">{spec.depthMin}</span>
                <input
                  type="range"
                  data-testid={`pin-${idx + 1}-slider`}
                  aria-label={`Pin ${idx + 1} cut depth`}
                  min={spec.depthMin}
                  max={spec.depthMax}
                  step={1}
                  value={depth}
                  onChange={(e) => onChangeCut(idx, Number.parseInt(e.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 dark:bg-zinc-800"
                />
                <span className="font-mono text-[10px] text-zinc-400">{spec.depthMax}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
