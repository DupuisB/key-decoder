import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkMacsViolations,
  computeBittingProfile,
  getAllSpacesMm,
  getRootDepthMm,
} from '../domain/bitting';
import { inToMm } from '../domain/keyways';
import type { AnchorAlignment, KeywaySpec, Point2D } from '../domain/types';

interface DecoderCanvasProps {
  spec: KeywaySpec;
  cuts: readonly number[];
  imageUrl: string | null;
  alignment: AnchorAlignment;
  activePinIndex: number | null;
  onChangeAlignment: (next: AnchorAlignment) => void;
  onUploadFile: (file: File) => void;
  onLoadSample: () => void;
  onSelectPin: (index: number | null) => void;
  onChangeCut: (pinIndex: number, nextDepth: number) => void;
}

type DragMode = 'none' | 'pan' | 'shoulder' | 'tip' | 'skew';

export function DecoderCanvas({
  spec,
  cuts,
  imageUrl,
  alignment,
  activePinIndex,
  onChangeAlignment,
  onUploadFile,
  onLoadSample,
  onSelectPin,
  onChangeCut,
}: DecoderCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 520 });
  const [viewZoom, setViewZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [showSkewHandle, setShowSkewHandle] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const dragStateRef = useRef<{
    mode: DragMode;
    startScreen: Point2D;
    startPan: Point2D;
    moved: boolean;
  }>({
    mode: 'none',
    startScreen: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
    moved: false,
  });

  useEffect(() => {
    if (!imageUrl) {
      setLoadedImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setLoadedImage(img);
        setViewZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        setCanvasSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bladeLengthMm = inToMm(spec.bladeLengthIn);
  const bladeWidthMm = inToMm(spec.bladeWidthIn);

  const stageW = loadedImage?.naturalWidth || 1280;
  const stageH = loadedImage?.naturalHeight || 720;

  const fitScale = Math.min((canvasSize.width * 0.96) / stageW, (canvasSize.height * 0.94) / stageH);
  const viewScale = fitScale * viewZoom;
  const centerX = canvasSize.width * 0.5 + pan.x;
  const centerY = canvasSize.height * 0.5 + pan.y;

  const normToScreen = useCallback(
    (pt: Point2D): Point2D => {
      const uVis = flipHorizontal ? 1 - pt.x : pt.x;
      return {
        x: centerX + (uVis - 0.5) * stageW * viewScale,
        y: centerY + (pt.y - 0.5) * stageH * viewScale,
      };
    },
    [centerX, centerY, flipHorizontal, stageH, stageW, viewScale],
  );

  const screenToNorm = useCallback(
    (pt: Point2D): Point2D => {
      const uVis = (pt.x - centerX) / (stageW * viewScale) + 0.5;
      const u = flipHorizontal ? 1 - uVis : uVis;
      const v = (pt.y - centerY) / (stageH * viewScale) + 0.5;
      return { x: u, y: v };
    },
    [centerX, centerY, flipHorizontal, stageH, stageW, viewScale],
  );

  const keyTransform = useMemo(() => {
    const shoulderScr = normToScreen(alignment.shoulder);
    const tipScr = normToScreen(alignment.tip);
    const dx = tipScr.x - shoulderScr.x;
    const dy = tipScr.y - shoulderScr.y;
    const anchorDistPx = Math.max(20, Math.hypot(dx, dy));
    const baseAngleRad = Math.atan2(dy, dx);
    const totalAngleRad = baseAngleRad + (alignment.rotationOffsetDeg * Math.PI) / 180;
    const pxPerMm = (anchorDistPx / bladeLengthMm) * alignment.scaleMultiplier;
    const ySign = alignment.flipVertical ? 1 : -1;
    const cos = Math.cos(totalAngleRad);
    const sin = Math.sin(totalAngleRad);

    const keyToScreen = (xMm: number, yMm: number): Point2D => {
      const lx = (xMm + yMm * alignment.skewY) * pxPerMm;
      const ly = ySign * yMm * pxPerMm * alignment.heightScaleMultiplier;
      return {
        x: shoulderScr.x + lx * cos - ly * sin,
        y: shoulderScr.y + lx * sin + ly * cos,
      };
    };

    const screenToKeyLocalPx = (pt: Point2D): Point2D => {
      const rx = pt.x - shoulderScr.x;
      const ry = pt.y - shoulderScr.y;
      return {
        x: rx * cos + ry * sin,
        y: -rx * sin + ry * cos,
      };
    };

    return {
      shoulderScr,
      tipScr,
      skewHandleScr: keyToScreen(bladeLengthMm * 0.5, bladeWidthMm),
      pxPerMm,
      ySign,
      keyToScreen,
      screenToKeyLocalPx,
    };
  }, [alignment, bladeLengthMm, bladeWidthMm, normToScreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(canvasSize.width * dpr);
    const targetH = Math.round(canvasSize.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // 1. Photo
    if (loadedImage) {
      ctx.save();
      ctx.translate(centerX, centerY);
      if (flipHorizontal) ctx.scale(-1, 1);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      const drawW = stageW * viewScale;
      const drawH = stageH * viewScale;
      ctx.drawImage(loadedImage, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    }

    // 2. Simple, high-contrast vector key outline + pin guides
    const { keyToScreen, shoulderScr, tipScr, skewHandleScr } = keyTransform;
    const profile = computeBittingProfile(spec, cuts);
    const spacesMm = getAllSpacesMm(spec);
    const macsViolations = checkMacsViolations(spec, cuts);
    const badPins = new Set<number>();
    for (const v of macsViolations) {
      badPins.add(v.pinIndexA);
      badPins.add(v.pinIndexB);
    }

    // Blade polygon
    ctx.beginPath();
    const sOrigin = keyToScreen(0, 0);
    ctx.moveTo(sOrigin.x, sOrigin.y);
    const sTipBot = keyToScreen(bladeLengthMm, 0);
    ctx.lineTo(sTipBot.x, sTipBot.y);
    const lastProf = profile[profile.length - 1]!;
    const sTipTop = keyToScreen(lastProf.x, lastProf.y);
    ctx.lineTo(sTipTop.x, sTipTop.y);
    for (let i = profile.length - 2; i >= 0; i--) {
      const p = keyToScreen(profile[i]!.x, profile[i]!.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();

    ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Shoulder stop vertical line
    const shLow = keyToScreen(0, -3);
    const shHigh = keyToScreen(0, bladeWidthMm + 3);
    ctx.beginPath();
    ctx.moveTo(shLow.x, shLow.y);
    ctx.lineTo(shHigh.x, shHigh.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pin vertical guides + subtle depth ticks
    const tickHalfMm = Math.min(0.55, inToMm(spec.pinSpacingIn) * 0.16);
    for (let i = 0; i < spec.pinCount; i++) {
      const cxMm = spacesMm[i]!;
      const cutVal = cuts[i] ?? spec.depthMin;
      const isFocused = activePinIndex === i;
      const isBad = badPins.has(i);

      const pBot = keyToScreen(cxMm, 0);
      const pTop = keyToScreen(cxMm, bladeWidthMm + 1.2);
      ctx.beginPath();
      ctx.moveTo(pBot.x, pBot.y);
      ctx.lineTo(pTop.x, pTop.y);
      ctx.strokeStyle = isBad
        ? 'rgba(239, 68, 68, 0.8)'
        : isFocused
          ? 'rgba(56, 189, 248, 0.9)'
          : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = isFocused ? 1.5 : 1;
      ctx.stroke();

      for (let d = spec.depthMin; d <= spec.depthMax; d++) {
        const yMm = getRootDepthMm(spec, d);
        const isCurrent = d === cutVal;
        const tL = keyToScreen(cxMm - (isCurrent ? tickHalfMm * 1.4 : tickHalfMm), yMm);
        const tR = keyToScreen(cxMm + (isCurrent ? tickHalfMm * 1.4 : tickHalfMm), yMm);
        ctx.beginPath();
        ctx.moveTo(tL.x, tL.y);
        ctx.lineTo(tR.x, tR.y);
        ctx.strokeStyle = isCurrent
          ? isBad
            ? '#ef4444'
            : '#facc15'
          : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = isCurrent ? 2.5 : 1;
        ctx.stroke();
      }

      // Plain pin number above line
      const lbl = keyToScreen(cxMm, bladeWidthMm + 2.4);
      ctx.font = '600 11px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isBad ? '#f87171' : '#f8fafc';
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(String(i + 1), lbl.x, lbl.y);
      ctx.fillText(String(i + 1), lbl.x, lbl.y);
    }

    // 3. Minimal draggable anchor handles (A = Shoulder, B = Tip, optional C = Skew)
    const drawAnchor = (pt: Point2D, letter: string, color: string) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '700 11px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, pt.x, pt.y + 0.5);
    };

    drawAnchor(shoulderScr, 'A', '#38bdf8');
    drawAnchor(tipScr, 'B', '#4ade80');
    if (showSkewHandle) {
      drawAnchor(skewHandleScr, 'C', '#c084fc');
    }

    ctx.restore();
  }, [
    activePinIndex,
    bladeLengthMm,
    bladeWidthMm,
    brightness,
    canvasSize,
    centerX,
    centerY,
    contrast,
    cuts,
    flipHorizontal,
    keyTransform,
    loadedImage,
    showSkewHandle,
    spec,
    stageH,
    stageW,
    viewScale,
  ]);

  const getLocalPointer = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getLocalPointer(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    const hitR = 22;
    const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

    let mode: DragMode = 'pan';
    if (dist(pt, keyTransform.shoulderScr) <= hitR) mode = 'shoulder';
    else if (dist(pt, keyTransform.tipScr) <= hitR) mode = 'tip';
    else if (showSkewHandle && dist(pt, keyTransform.skewHandleScr) <= hitR) mode = 'skew';

    dragStateRef.current = { mode, startScreen: pt, startPan: { ...pan }, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = dragStateRef.current;
    if (state.mode === 'none') return;

    const pt = getLocalPointer(e);
    if (Math.hypot(pt.x - state.startScreen.x, pt.y - state.startScreen.y) > 2) {
      state.moved = true;
    }

    if (state.mode === 'pan') {
      setPan({
        x: state.startPan.x + (pt.x - state.startScreen.x),
        y: state.startPan.y + (pt.y - state.startScreen.y),
      });
    } else if (state.mode === 'shoulder') {
      onChangeAlignment({ ...alignment, shoulder: screenToNorm(pt) });
    } else if (state.mode === 'tip') {
      onChangeAlignment({ ...alignment, tip: screenToNorm(pt) });
    } else if (state.mode === 'skew') {
      const localPx = keyTransform.screenToKeyLocalPx(pt);
      const denom = Math.max(10, bladeWidthMm * keyTransform.pxPerMm);
      const nextHeight = Math.max(0.65, Math.min(1.45, (localPx.y * keyTransform.ySign) / denom));
      const expectedX = bladeLengthMm * 0.5 * keyTransform.pxPerMm;
      const nextSkew = Math.max(-0.35, Math.min(0.35, (localPx.x - expectedX) / denom));
      onChangeAlignment({
        ...alignment,
        heightScaleMultiplier: Number(nextHeight.toFixed(3)),
        skewY: Number(nextSkew.toFixed(3)),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const state = dragStateRef.current;
    if (state.mode === 'pan' && !state.moved) {
      const pt = getLocalPointer(e);
      const spacesMm = getAllSpacesMm(spec);
      let bestPin = -1;
      let bestDepth = spec.depthMin;
      let bestDist = 18;
      for (let i = 0; i < spec.pinCount; i++) {
        for (let d = spec.depthMin; d <= spec.depthMax; d++) {
          const tickScr = keyTransform.keyToScreen(spacesMm[i]!, getRootDepthMm(spec, d));
          const dd = Math.hypot(tickScr.x - pt.x, tickScr.y - pt.y);
          if (dd < bestDist) {
            bestDist = dd;
            bestPin = i;
            bestDepth = d;
          }
        }
      }
      if (bestPin >= 0) {
        onSelectPin(bestPin);
        onChangeCut(bestPin, bestDepth);
      }
    }
    dragStateRef.current.mode = 'none';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setViewZoom((z) => Math.max(0.4, Math.min(6, Number((z * factor).toFixed(3)))));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) onUploadFile(file);
  };

  const btnCls =
    'rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';

  return (
    <div className="flex flex-col">
      {/* Simple single toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-testid="photo-file-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            data-testid="upload-photo-btn"
            onClick={() => fileInputRef.current?.click()}
            className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Open Photo
          </button>
          <button
            type="button"
            data-testid="load-sample-btn"
            onClick={onLoadSample}
            className={btnCls}
          >
            Sample Key
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewZoom((z) => Math.max(0.4, Number((z / 1.15).toFixed(3))))}
            aria-label="Zoom out"
            className={btnCls}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setViewZoom((z) => Math.min(6, Number((z * 1.15).toFixed(3))))}
            aria-label="Zoom in"
            className={btnCls}
          >
            +
          </button>
          <button
            type="button"
            data-testid="flip-horizontal-btn"
            onClick={() => setFlipHorizontal((f) => !f)}
            className={btnCls}
          >
            Flip H
          </button>
          <button
            type="button"
            data-testid="flip-vertical-btn"
            onClick={() => onChangeAlignment({ ...alignment, flipVertical: !alignment.flipVertical })}
            className={btnCls}
          >
            Flip V
          </button>
          <button
            type="button"
            data-testid="toggle-adjust-tools-btn"
            onClick={() => setShowTools((s) => !s)}
            className={btnCls}
          >
            {showTools ? 'Hide tools' : 'Adjust'}
          </button>
        </div>
      </div>

      {/* Collapsible fine-tune / image adjustments (hidden by default) */}
      {showTools && (
        <div
          data-testid="adjust-tools-bar"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
        >
          <div className="flex items-center gap-1">
            <span>Rot:</span>
            <button
              type="button"
              data-testid="nudge-rot-minus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  rotationOffsetDeg: Number((alignment.rotationOffsetDeg - 0.5).toFixed(1)),
                })
              }
              className={btnCls}
            >
              −0.5°
            </button>
            <button
              type="button"
              data-testid="nudge-rot-plus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  rotationOffsetDeg: Number((alignment.rotationOffsetDeg + 0.5).toFixed(1)),
                })
              }
              className={btnCls}
            >
              +0.5°
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span>Scale:</span>
            <button
              type="button"
              data-testid="nudge-scale-minus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  scaleMultiplier: Math.max(0.5, Number((alignment.scaleMultiplier - 0.005).toFixed(4))),
                })
              }
              className={btnCls}
            >
              −0.5%
            </button>
            <button
              type="button"
              data-testid="nudge-scale-plus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  scaleMultiplier: Math.min(1.6, Number((alignment.scaleMultiplier + 0.005).toFixed(4))),
                })
              }
              className={btnCls}
            >
              +0.5%
            </button>
          </div>

          <label className="flex items-center gap-1.5">
            <span>Bright</span>
            <input
              type="range"
              min={50}
              max={180}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-20 accent-blue-600"
            />
          </label>

          <label className="flex items-center gap-1.5">
            <span>Contrast</span>
            <input
              type="range"
              min={50}
              max={200}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-20 accent-blue-600"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              data-testid="toggle-skew-handle-btn"
              checked={showSkewHandle}
              onChange={(e) => setShowSkewHandle(e.target.checked)}
              className="accent-blue-600"
            />
            Skew handle (C)
          </label>

          <button
            type="button"
            onClick={() => {
              setViewZoom(1);
              setPan({ x: 0, y: 0 });
              setBrightness(100);
              setContrast(100);
              onChangeAlignment({
                ...alignment,
                rotationOffsetDeg: 0,
                scaleMultiplier: 1,
                heightScaleMultiplier: 1,
                skewY: 0,
              });
            }}
            className="text-xs underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Reset view
          </button>
        </div>
      )}

      {/* Main Canvas */}
      <div
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative h-[420px] w-full select-none overflow-hidden bg-zinc-900 sm:h-[520px] ${
          isDragOver ? 'ring-2 ring-blue-500 ring-inset' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          data-testid="decoder-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
          className="block h-full w-full cursor-grab active:cursor-grabbing"
        />

        {!loadedImage && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
            <div className="pointer-events-auto rounded bg-zinc-950/85 px-3 py-1.5 text-xs text-zinc-200">
              Drop a key photo here, click <strong>Open Photo</strong>, or load a{' '}
              <button
                type="button"
                onClick={onLoadSample}
                className="underline underline-offset-2 hover:text-white"
              >
                Sample Key
              </button>
              .
            </div>
          </div>
        )}
      </div>

      {/* Quiet 1-line instruction footer */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        Drag <strong>A</strong> to the shoulder stop and <strong>B</strong> to the blade tip. Drag background to pan, scroll to zoom.
      </div>
    </div>
  );
}
