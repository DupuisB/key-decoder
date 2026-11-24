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
  const [verticalCard, setVerticalCard] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : true,
  );
  const [flipKeyH, setFlipKeyH] = useState<boolean>(false);
  const [rotateKey90, setRotateKey90] = useState<boolean>(false);
  const [lightPad, setLightPad] = useState<boolean>(true);

  const dragRef = useRef<{ startPos: number; startLongPx: number } | null>(null);

  useEffect(() => {
    saveScreenScale({ pxPerMm, locked, cardEdge: 'long' });
  }, [pxPerMm, locked]);

  const cardLongPx = mmToScreenPx(CARD_LONG_MM, pxPerMm);
  const cardShortPx = mmToScreenPx(CARD_SHORT_MM, pxPerMm);

  const onDragStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startPos: verticalCard ? e.clientY : e.clientX,
      startLongPx: cardLongPx,
    };
  };

  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = verticalCard ? e.clientY : e.clientX;
    const nextPx = Math.max(160, drag.startLongPx + (pos - drag.startPos));
    setPxPerMm(cardPxToPxPerMm(nextPx, 'long'));
  };

  const onDragEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const keySvg = useMemo(() => {
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

    const bowLenMm = Math.min(16, spec.bow.lengthMm * 0.7);
    const shoulderTopMm = bladeWidthMm + 3.0;
    const shoulderBotMm = -2.6;
    const topPadMm = 5.5;
    const botPadMm = 3.5;
    const leftPadMm = bowLenMm + 2.5;
    const rightPadMm = 3.5;

    const totalWidthMm = leftPadMm + bladeLengthMm + rightPadMm;
    const totalHeightMm = topPadMm + (shoulderTopMm - shoulderBotMm) + botPadMm;

    const toSvg = (xMm: number, yMm: number) => ({
      x: leftPadMm + xMm,
      y: topPadMm + (shoulderTopMm - yMm),
    });

    const pts = [
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

    return {
      totalWidthMm,
      totalHeightMm,
      pathD,
      shoulderTop: toSvg(0, shoulderTopMm + 1.5),
      shoulderBot: toSvg(0, shoulderBotMm - 1.2),
      spineStart: toSvg(0, 0),
      spineEnd: toSvg(bladeLengthMm, 0),
      pins: spacesMm.map((cxMm, idx) => ({
        index: idx,
        isBad: badPins.has(idx),
        top: toSvg(cxMm, bladeWidthMm + 0.8),
        bot: toSvg(cxMm, 0),
        root: toSvg(cxMm, getRootDepthMm(spec, cuts[idx] ?? spec.depthMin)),
        label: toSvg(cxMm, bladeWidthMm + 2.8),
      })),
    };
  }, [cuts, spec]);

  if (!locked) {
    // Visual ISO/IEC 7810 ID-1 bank card outline — self-explanatory with zero paragraphs
    const cardW = verticalCard ? cardShortPx : cardLongPx;
    const cardH = verticalCard ? cardLongPx : cardShortPx;
    const cornerR = mmToScreenPx(3.18, pxPerMm);

    return (
      <div
        data-testid="screen-calibration-view"
        className="flex flex-1 flex-col justify-between bg-[#f5f5f7] dark:bg-black"
      >
        {/* Full-bleed card matching stage */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto p-6">
          <div
            data-testid="card-calibration-bar"
            style={{
              width: `${cardW}px`,
              height: `${cardH}px`,
              borderRadius: `${cornerR}px`,
            }}
            className="relative shrink-0 border-2 border-[#007aff] bg-[#007aff]/[0.07] dark:border-[#0a84ff] dark:bg-[#0a84ff]/[0.12]"
          >
            {/* Subtle EMV chip glyph so it reads instantly as a bank/ID card */}
            <div
              style={{
                width: `${mmToScreenPx(12, pxPerMm)}px`,
                height: `${mmToScreenPx(9.5, pxPerMm)}px`,
                top: verticalCard ? `${mmToScreenPx(15, pxPerMm)}px` : '50%',
                left: verticalCard ? '50%' : `${mmToScreenPx(14, pxPerMm)}px`,
                transform: verticalCard ? 'translateX(-50%)' : 'translateY(-50%)',
              }}
              className="absolute rounded-[3px] border border-[#007aff]/40 bg-[#007aff]/10"
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-semibold text-[#007aff] dark:text-[#0a84ff]">Bank / ID Card</span>
              <span className="mt-0.5 font-mono text-[11px] tabular-nums text-[#007aff]/70 dark:text-[#0a84ff]/80">
                85.6 × 54.0 mm
              </span>
            </div>

            {/* Draggable edge handle */}
            <button
              type="button"
              data-testid="card-drag-handle"
              aria-label="Drag to match card size"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              style={{ touchAction: 'none' }}
              className={
                verticalCard
                  ? 'absolute -bottom-3.5 left-1/2 h-7 w-16 -translate-x-1/2 cursor-ns-resize rounded-full bg-[#007aff] text-xs font-semibold text-white shadow-md'
                  : 'absolute -right-3.5 top-1/2 h-16 w-7 -translate-y-1/2 cursor-ew-resize rounded-full bg-[#007aff] text-xs font-semibold text-white shadow-md'
              }
            >
              {verticalCard ? '↕' : '↔'}
            </button>
          </div>
        </div>

        {/* Single compact calibration bar */}
        <div className="flex flex-col gap-2.5 border-t border-black/8 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1c1c1e]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-testid="scale-dec-btn"
              aria-label="Smaller"
              onClick={() => setPxPerMm((v) => clampPxPerMm(v - 0.05))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-base dark:bg-white/[0.1]"
            >
              −
            </button>
            <input
              type="range"
              data-testid="screen-scale-slider"
              aria-label="Card scale"
              min={MIN_PX_PER_MM}
              max={MAX_PX_PER_MM}
              step={0.01}
              value={pxPerMm}
              onChange={(e) => setPxPerMm(clampPxPerMm(Number.parseFloat(e.target.value)))}
              className="flex-1"
            />
            <button
              type="button"
              data-testid="scale-inc-btn"
              aria-label="Larger"
              onClick={() => setPxPerMm((v) => clampPxPerMm(v + 0.05))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.06] text-base dark:bg-white/[0.1]"
            >
              +
            </button>
            <button
              type="button"
              data-testid="toggle-bar-orientation-btn"
              onClick={() => setVerticalCard((v) => !v)}
              className="shrink-0 rounded-lg bg-black/[0.06] px-2.5 py-1.5 text-xs font-medium dark:bg-white/[0.1]"
            >
              {verticalCard ? 'Rotate' : 'Rotate'}
            </button>
          </div>

          <button
            type="button"
            data-testid="lock-scale-btn"
            onClick={() => setLocked(true)}
            className="h-10 w-full rounded-xl bg-[#007aff] text-sm font-semibold text-white transition hover:bg-[#0066d6] active:scale-[0.99]"
          >
            Lock Scale
          </button>
        </div>
      </div>
    );
  }

  // Locked 1:1 Backlit Trace Pad — zero chrome, edge-to-edge pure backlit silhouette
  const svgW = mmToScreenPx(keySvg.totalWidthMm, pxPerMm);
  const svgH = mmToScreenPx(keySvg.totalHeightMm, pxPerMm);
  const boxW = rotateKey90 ? svgH : svgW;
  const boxH = rotateKey90 ? svgW : svgH;

  const ctrlBtn = lightPad
    ? 'rounded-lg bg-black/[0.06] px-2.5 py-1 text-xs font-medium text-black/75 hover:bg-black/[0.12]'
    : 'rounded-lg bg-white/[0.12] px-2.5 py-1 text-xs font-medium text-white/85 hover:bg-white/[0.2]';

  return (
    <div
      data-testid="screen-trace-locked-view"
      className={`relative flex flex-1 flex-col items-center justify-center overflow-auto select-none ${
        lightPad ? 'bg-white' : 'bg-black'
      }`}
      style={{ minHeight: rotateKey90 ? `${Math.max(280, Math.ceil(boxH + 76))}px` : '220px' }}
    >
      {/* Quiet floating controls top-right */}
      <div className="absolute right-3 top-2.5 flex items-center gap-1">
        <button type="button" data-testid="trace-flip-btn" onClick={() => setFlipKeyH((f) => !f)} className={ctrlBtn}>
          Flip
        </button>
        <button
          type="button"
          data-testid="trace-rotate-btn"
          onClick={() => setRotateKey90((r) => !r)}
          className={ctrlBtn}
        >
          Rotate
        </button>
        <button
          type="button"
          data-testid="trace-contrast-btn"
          onClick={() => setLightPad((l) => !l)}
          className={ctrlBtn}
        >
          {lightPad ? 'Dark' : 'Light'}
        </button>
        <button
          type="button"
          data-testid="recalibrate-scale-btn"
          onClick={() => setLocked(false)}
          className={ctrlBtn}
        >
          Scale
        </button>
      </div>

      {/* Exact 1:1 physical millimeter SVG (pointer-events-none so metal key triggers zero touches) */}
      <div
        className="pointer-events-none flex items-center justify-center pt-7 pb-3"
        style={{ width: `${boxW}px`, height: `${boxH + 40}px` }}
      >
        <svg
          data-testid="trace-1to1-svg"
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${keySvg.totalWidthMm} ${keySvg.totalHeightMm}`}
          style={{
            transform: `${rotateKey90 ? 'rotate(90deg)' : ''} ${flipKeyH ? 'scaleX(-1)' : ''}`.trim() || undefined,
            overflow: 'visible',
          }}
        >
          <path
            d={keySvg.pathD}
            fill={lightPad ? '#000000' : '#ffffff'}
            fillOpacity={lightPad ? 0.16 : 0.22}
            stroke={lightPad ? '#007aff' : '#38bdf8'}
            strokeWidth={0.35}
          />

          {/* Red shoulder alignment stop */}
          <line
            x1={keySvg.shoulderTop.x}
            y1={keySvg.shoulderTop.y}
            x2={keySvg.shoulderBot.x}
            y2={keySvg.shoulderBot.y}
            stroke="#ff3b30"
            strokeWidth={0.45}
            strokeDasharray="1.1 0.7"
          />

          <line
            x1={keySvg.spineStart.x}
            y1={keySvg.spineStart.y}
            x2={keySvg.spineEnd.x}
            y2={keySvg.spineEnd.y}
            stroke={lightPad ? '#007aff' : '#38bdf8'}
            strokeWidth={0.45}
          />

          {keySvg.pins.map((p) => {
            const focused = activePinIndex === p.index;
            return (
              <g key={p.index}>
                <line
                  x1={p.top.x}
                  y1={p.top.y}
                  x2={p.bot.x}
                  y2={p.bot.y}
                  stroke={
                    p.isBad
                      ? '#ff3b30'
                      : focused
                        ? '#007aff'
                        : lightPad
                          ? 'rgba(0,122,255,0.35)'
                          : 'rgba(56,189,248,0.45)'
                  }
                  strokeWidth={focused ? 0.4 : 0.22}
                />
                <circle cx={p.root.x} cy={p.root.y} r={focused ? 0.65 : 0.42} fill={p.isBad ? '#ff3b30' : '#ff9500'} />
                <text
                  x={p.label.x}
                  y={p.label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={p.isBad ? '#ff3b30' : lightPad ? '#1d1d1f' : '#f5f5f7'}
                  fontSize={2.3}
                  fontWeight={600}
                  fontFamily="-apple-system, ui-monospace, monospace"
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
  );
}
