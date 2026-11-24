import { useEffect, useMemo, useRef, useState } from 'react';
import {
  checkMacsViolations,
  computeBittingProfile,
  getAllSpacesMm,
  getRootDepthMm,
} from '../domain/bitting';
import { inToMm } from '../domain/keyways';
import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  type CardEdgeMode,
  cardPxToPxPerMm,
  clampPxPerMm,
  loadScreenScale,
  MAX_PX_PER_MM,
  MIN_PX_PER_MM,
  mmToScreenPx,
  saveScreenScale,
} from '../domain/screenScale';
import type { KeywaySpec } from '../domain/types';

interface ScreenTraceModeProps {
  spec: KeywaySpec;
  cuts: readonly number[];
  activePinIndex: number | null;
}

export function ScreenTraceMode({ spec, cuts, activePinIndex }: ScreenTraceModeProps) {
  const initial = useMemo(() => loadScreenScale(), []);
  const [pxPerMm, setPxPerMm] = useState<number>(initial.pxPerMm);
  const [locked, setLocked] = useState<boolean>(initial.locked);
  const [cardEdge, setCardEdge] = useState<CardEdgeMode>(initial.cardEdge);
  const [barVertical, setBarVertical] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : true,
  );
  const [flipKeyH, setFlipKeyH] = useState<boolean>(false);
  const [rotateKey90, setRotateKey90] = useState<boolean>(false);
  const [highContrastLight, setHighContrastLight] = useState<boolean>(true);

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{ startPos: number; startPx: number } | null>(null);

  useEffect(() => {
    saveScreenScale({ pxPerMm, locked, cardEdge });
  }, [pxPerMm, locked, cardEdge]);

  const refMm = cardEdge === 'long' ? CARD_LONG_MM : CARD_SHORT_MM;
  const cardPx = mmToScreenPx(refMm, pxPerMm);

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragOriginRef.current = {
      startPos: barVertical ? e.clientY : e.clientX,
      startPx: cardPx,
    };
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragOriginRef.current;
    if (!drag) return;
    const currPos = barVertical ? e.clientY : e.clientX;
    const nextCardPx = Math.max(80, drag.startPx + (currPos - drag.startPos));
    setPxPerMm(cardPxToPxPerMm(nextCardPx, cardEdge));
  };

  const handleRulerPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragOriginRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Compute exact 1:1 physical SVG geometry in millimeters (scaled 1:1 to CSS px via pxPerMm!)
  const keySvgData = useMemo(() => {
    const bladeLengthMm = inToMm(spec.bladeLengthIn);
    const bladeWidthMm = inToMm(spec.bladeWidthIn);
    const profile = computeBittingProfile(spec, cuts);
    const spacesMm = getAllSpacesMm(spec);
    const macsViolations = checkMacsViolations(spec, cuts);
    const badPins = new Set<number>();
    for (const v of macsViolations) {
      badPins.add(v.pinIndexA);
      badPins.add(v.pinIndexB);
    }

    // Physical key outline in mm: origin (0,0) = shoulder bottom spine, +X right, +Y UP
    // Convert to SVG (+Y DOWN): svgY = topPadMm + (maxTopMm - yMm)
    const bowLenMm = Math.min(18, spec.bow.lengthMm * 0.78);
    const shoulderTopMm = bladeWidthMm + 3.2;
    const shoulderBotMm = -2.8;
    const topPadMm = 6.5; // room for pin numbers
    const botPadMm = 4.5;
    const leftPadMm = bowLenMm + 3;
    const rightPadMm = 4.5;

    const totalWidthMm = leftPadMm + bladeLengthMm + rightPadMm;
    const totalHeightMm = topPadMm + (shoulderTopMm - shoulderBotMm) + botPadMm;

    const toSvg = (xMm: number, yMm: number) => ({
      x: leftPadMm + xMm,
      y: topPadMm + (shoulderTopMm - yMm),
    });

    // Build closed silhouette path (partial bow neck + shoulder steps + blade + cuts + tip)
    const pts: { x: number; y: number }[] = [
      toSvg(-bowLenMm, shoulderBotMm),
      toSvg(0, shoulderBotMm),
      toSvg(0, 0),
      toSvg(bladeLengthMm, 0),
    ];
    for (let i = profile.length - 1; i >= 0; i--) {
      pts.push(toSvg(profile[i]!.x, profile[i]!.y));
    }
    pts.push(toSvg(0, shoulderTopMm));
    pts.push(toSvg(-bowLenMm, shoulderTopMm));

    const pathD =
      pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(' ') + ' Z';

    const shoulderLineTop = toSvg(0, shoulderTopMm + 1.8);
    const shoulderLineBot = toSvg(0, shoulderBotMm - 1.5);
    const spineStart = toSvg(0, 0);
    const spineEnd = toSvg(bladeLengthMm, 0);
    const uncutStart = toSvg(0, bladeWidthMm);
    const uncutEnd = toSvg(bladeLengthMm * 0.94, bladeWidthMm);

    const pins = spacesMm.map((cxMm, idx) => {
      const depth = cuts[idx] ?? spec.depthMin;
      const rootMm = getRootDepthMm(spec, depth);
      return {
        index: idx,
        depth,
        isBad: badPins.has(idx),
        top: toSvg(cxMm, bladeWidthMm + 1.0),
        bot: toSvg(cxMm, 0),
        root: toSvg(cxMm, rootMm),
        label: toSvg(cxMm, bladeWidthMm + 3.2),
      };
    });

    return {
      totalWidthMm,
      totalHeightMm,
      pathD,
      shoulderLineTop,
      shoulderLineBot,
      spineStart,
      spineEnd,
      uncutStart,
      uncutEnd,
      pins,
    };
  }, [cuts, spec]);

  const btnCls =
    'rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

  if (!locked) {
    // STEP 1: Calibrate physical screen scale with a real bank/ID card (ISO 7810 ID-1)
    return (
      <div data-testid="screen-calibration-view" className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="card-edge-long-btn"
              onClick={() => setCardEdge('long')}
              className={`rounded border px-2 py-1 text-xs ${
                cardEdge === 'long'
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              Long side (85.6 mm)
            </button>
            <button
              type="button"
              data-testid="card-edge-short-btn"
              onClick={() => setCardEdge('short')}
              className={`rounded border px-2 py-1 text-xs ${
                cardEdge === 'short'
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                  : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
              }`}
            >
              Short side (54.0 mm)
            </button>
          </div>

          <button
            type="button"
            data-testid="toggle-bar-orientation-btn"
            onClick={() => setBarVertical((v) => !v)}
            className={btnCls}
          >
            {barVertical ? 'Horizontal' : 'Vertical'}
          </button>
        </div>

        {/* Calibration Instructions + Fine Controls */}
        <div className="space-y-2.5 border-b border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Hold the <strong>{cardEdge === 'long' ? 'long side (85.60 mm)' : 'short side (53.98 mm)'}</strong> of a
            bank or ID card flat against the screen. Adjust until the bar matches the card, then lock.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="scale-dec-btn"
              aria-label="Decrease scale"
              onClick={() => setPxPerMm((v) => clampPxPerMm(v - 0.05))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              −
            </button>
            <input
              type="range"
              data-testid="screen-scale-slider"
              aria-label="Screen scale in pixels per millimeter"
              min={MIN_PX_PER_MM}
              max={MAX_PX_PER_MM}
              step={0.01}
              value={pxPerMm}
              onChange={(e) => setPxPerMm(clampPxPerMm(Number.parseFloat(e.target.value)))}
              className="h-2 flex-1 cursor-pointer accent-blue-600"
            />
            <button
              type="button"
              data-testid="scale-inc-btn"
              aria-label="Increase scale"
              onClick={() => setPxPerMm((v) => clampPxPerMm(v + 0.05))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              +
            </button>
            <span
              data-testid="scale-readout"
              className="w-18 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400"
            >
              {pxPerMm.toFixed(2)} px/mm
            </span>
          </div>

          <button
            type="button"
            data-testid="lock-scale-btn"
            onClick={() => setLocked(true)}
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
          >
            Lock Scale &amp; Place Key
          </button>
        </div>

        {/* Physical Card Matching Surface */}
        <div
          ref={rulerRef}
          className="relative flex min-h-[340px] w-full items-start justify-center overflow-auto bg-white p-5 dark:bg-zinc-900"
        >
          {barVertical ? (
            <div className="flex items-start gap-4">
              {/* Vertical calibration caliper bar */}
              <div
                data-testid="card-calibration-bar"
                style={{ height: `${cardPx}px` }}
                className="relative w-24 shrink-0 border-y-2 border-l-2 border-blue-600 bg-blue-500/10"
              >
                <div className="absolute -top-2.5 right-1 rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap text-white">
                  0 mm
                </div>

                {/* 10 mm reference ticks */}
                {Array.from({ length: Math.floor(refMm / 10) }, (_, i) => {
                  const mm = (i + 1) * 10;
                  return (
                    <div
                      key={mm}
                      style={{ top: `${mmToScreenPx(mm, pxPerMm)}px` }}
                      className="absolute left-0 flex items-center gap-1"
                    >
                      <span className="block h-px w-2.5 bg-blue-600/70" />
                      <span className="font-mono text-[9px] text-blue-700 dark:text-blue-300">{mm}</span>
                    </div>
                  );
                })}

                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-right font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  {refMm.toFixed(1)}
                  <span className="block text-[9px] font-normal">mm</span>
                </div>

                {/* Draggable bottom handle */}
                <button
                  type="button"
                  data-testid="card-drag-handle"
                  onPointerDown={handleRulerPointerDown}
                  onPointerMove={handleRulerPointerMove}
                  onPointerUp={handleRulerPointerUp}
                  onPointerCancel={handleRulerPointerUp}
                  style={{ touchAction: 'none' }}
                  className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 cursor-ns-resize rounded bg-blue-600 px-2.5 py-1 font-mono text-[10px] font-semibold whitespace-nowrap text-white shadow"
                >
                  ↕ Drag edge
                </button>
              </div>

              <div className="max-w-[160px] pt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Line the top edge of your card up with <strong>0 mm</strong>, then drag the bottom handle or use the
                slider until it meets the far edge of your card.
              </div>
            </div>
          ) : (
            <div className="w-full py-6">
              <div
                data-testid="card-calibration-bar"
                style={{ width: `${cardPx}px` }}
                className="relative h-24 border-x-2 border-t-2 border-blue-600 bg-blue-500/10"
              >
                <div className="absolute -top-2.5 left-2 rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  0 mm
                </div>

                {Array.from({ length: Math.floor(refMm / 10) }, (_, i) => {
                  const mm = (i + 1) * 10;
                  return (
                    <div
                      key={mm}
                      style={{ left: `${mmToScreenPx(mm, pxPerMm)}px` }}
                      className="absolute top-0 flex flex-col items-center"
                    >
                      <span className="block h-3 w-px bg-blue-600/70" />
                      <span className="font-mono text-[9px] text-blue-700 dark:text-blue-300">{mm}</span>
                    </div>
                  );
                })}

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {refMm.toFixed(2)} mm
                </div>

                <button
                  type="button"
                  data-testid="card-drag-handle"
                  onPointerDown={handleRulerPointerDown}
                  onPointerMove={handleRulerPointerMove}
                  onPointerUp={handleRulerPointerUp}
                  onPointerCancel={handleRulerPointerUp}
                  style={{ touchAction: 'none' }}
                  className="absolute -right-3 top-1/2 -translate-y-1/2 cursor-ew-resize rounded bg-blue-600 px-2 py-1 font-mono text-[10px] font-semibold text-white shadow"
                >
                  ↔
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 2: Locked 1:1 Physical Key Trace Surface (put physical key right on top of the screen!)
  const svgWidthPx = mmToScreenPx(keySvgData.totalWidthMm, pxPerMm);
  const svgHeightPx = mmToScreenPx(keySvgData.totalHeightMm, pxPerMm);
  const displayW = rotateKey90 ? svgHeightPx : svgWidthPx;
  const displayH = rotateKey90 ? svgWidthPx : svgHeightPx;

  const bgClass = highContrastLight ? 'bg-white' : 'bg-black';
  const fillCol = highContrastLight ? '#111827' : '#ffffff';
  const strokeCol = highContrastLight ? '#2563eb' : '#38bdf8';
  const shoulderCol = '#ef4444';
  const pinLineCol = highContrastLight ? 'rgba(37,99,235,0.45)' : 'rgba(56,189,248,0.55)';
  const labelCol = highContrastLight ? '#111827' : '#f8fafc';

  return (
    <div data-testid="screen-trace-locked-view" className="flex flex-col">
      {/* Compact locked bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">1:1 Locked</span>
          <span className="font-mono text-zinc-500">({pxPerMm.toFixed(2)} px/mm)</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="trace-flip-btn"
            onClick={() => setFlipKeyH((f) => !f)}
            className={btnCls}
          >
            Flip
          </button>
          <button
            type="button"
            data-testid="trace-rotate-btn"
            onClick={() => setRotateKey90((r) => !r)}
            className={btnCls}
          >
            {rotateKey90 ? 'Horizontal' : 'Vertical'}
          </button>
          <button
            type="button"
            data-testid="trace-contrast-btn"
            onClick={() => setHighContrastLight((l) => !l)}
            className={btnCls}
          >
            {highContrastLight ? 'Black BG' : 'White BG'}
          </button>
          <button
            type="button"
            data-testid="recalibrate-scale-btn"
            onClick={() => setLocked(false)}
            className={btnCls}
          >
            Recalibrate
          </button>
        </div>
      </div>

      {/* Backlit 1:1 Physical Trace Surface (pointer-events-none on SVG so resting metal key causes zero phantom gestures!) */}
      <div
        className={`flex items-center justify-center overflow-auto px-2 py-5 select-none ${bgClass}`}
        style={{ minHeight: rotateKey90 ? `${Math.max(280, Math.ceil(displayH + 40))}px` : '220px' }}
      >
        <div
          className="pointer-events-none flex items-center justify-center"
          style={{ width: `${displayW}px`, height: `${displayH}px` }}
        >
          <svg
            data-testid="trace-1to1-svg"
            width={svgWidthPx}
            height={svgHeightPx}
            viewBox={`0 0 ${keySvgData.totalWidthMm} ${keySvgData.totalHeightMm}`}
            style={{
              transform: `${rotateKey90 ? 'rotate(90deg)' : ''} ${flipKeyH ? 'scaleX(-1)' : ''}`.trim() || undefined,
              overflow: 'visible',
            }}
          >
            {/* Solid 1:1 physical silhouette */}
            <path d={keySvgData.pathD} fill={fillCol} fillOpacity={0.22} stroke={strokeCol} strokeWidth={0.35} />

            {/* Crisp red shoulder stop alignment line */}
            <line
              x1={keySvgData.shoulderLineTop.x}
              y1={keySvgData.shoulderLineTop.y}
              x2={keySvgData.shoulderLineBot.x}
              y2={keySvgData.shoulderLineBot.y}
              stroke={shoulderCol}
              strokeWidth={0.45}
              strokeDasharray="1.1 0.7"
            />

            {/* Straight bottom spine line */}
            <line
              x1={keySvgData.spineStart.x}
              y1={keySvgData.spineStart.y}
              x2={keySvgData.spineEnd.x}
              y2={keySvgData.spineEnd.y}
              stroke={strokeCol}
              strokeWidth={0.45}
            />

            {/* Faint uncut blank top edge reference */}
            <line
              x1={keySvgData.uncutStart.x}
              y1={keySvgData.uncutStart.y}
              x2={keySvgData.uncutEnd.x}
              y2={keySvgData.uncutEnd.y}
              stroke={pinLineCol}
              strokeWidth={0.22}
              strokeDasharray="0.9 0.9"
            />

            {/* Per-pin vertical guide lines & labels */}
            {keySvgData.pins.map((p) => {
              const isFocused = activePinIndex === p.index;
              return (
                <g key={p.index}>
                  <line
                    x1={p.top.x}
                    y1={p.top.y}
                    x2={p.bot.x}
                    y2={p.bot.y}
                    stroke={p.isBad ? '#ef4444' : isFocused ? '#2563eb' : pinLineCol}
                    strokeWidth={isFocused ? 0.4 : 0.22}
                  />
                  <circle
                    cx={p.root.x}
                    cy={p.root.y}
                    r={isFocused ? 0.65 : 0.45}
                    fill={p.isBad ? '#ef4444' : '#f59e0b'}
                  />
                  <text
                    x={p.label.x}
                    y={p.label.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={p.isBad ? '#ef4444' : labelCol}
                    fontSize={2.4}
                    fontWeight={700}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    transform={flipKeyH ? `translate(${p.label.x * 2}, 0) scale(-1, 1)` : undefined}
                  >
                    {p.index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Concise 1-line practical hint */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        Place your key flat on the screen with its shoulder on the <strong className="text-red-500">red line</strong>,
        then step the pin cuts below until the outline matches every tooth.
      </div>
    </div>
  );
}
