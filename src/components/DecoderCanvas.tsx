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

type DragMode = 'none' | 'pan' | 'shoulder' | 'width' | 'spineAngle' | 'skew';

function normalizeAngleDeg(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a <= -180) a += 360;
  return Number(a.toFixed(2));
}

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

  /**
   * Locksmith-accurate blade-width & top-shoulder coordinate frame:
   * - Handle A: Top Shoulder Stop corner (x = 0, y = bladeWidthMm)
   * - Handle H: Bottom Spine width caliper (sets exact mm/px scale from factory bladeWidthMm, independent of tip length)
   * - Handle B: Bottom Spine angle guide (sets exact spine rotation angle without changing scale)
   */
  const keyTransform = useMemo(() => {
    const shoulderTopScr = normToScreen(alignment.shoulderTop);
    const baseAngleRad = ((alignment.angleDeg + alignment.rotationOffsetDeg) * Math.PI) / 180;
    const thetaVis = flipHorizontal ? Math.PI - baseAngleRad : baseAngleRad;

    const dir: Point2D = { x: Math.cos(thetaVis), y: Math.sin(thetaVis) };
    const sSign = (flipHorizontal ? -1 : 1) * (alignment.flipVertical ? -1 : 1);
    // Unit vector pointing from top edge (A) down to bottom spine (y = 0)
    const spineDir: Point2D = {
      x: -sSign * Math.sin(thetaVis),
      y: sSign * Math.cos(thetaVis),
    };

    const bladeWidthPx = Math.max(
      14,
      alignment.bladeWidthRatio * stageH * viewScale * alignment.scaleMultiplier,
    );
    const pxPerMm = bladeWidthPx / bladeWidthMm;
    const effectiveSpineDistPx = bladeWidthPx * alignment.heightScaleMultiplier;

    const keyToScreen = (xMm: number, yMm: number): Point2D => {
      const dyDownMm = bladeWidthMm - yMm;
      const ux = (xMm + (yMm - bladeWidthMm) * alignment.skewY) * pxPerMm;
      const uy = dyDownMm * pxPerMm * alignment.heightScaleMultiplier;
      return {
        x: shoulderTopScr.x + ux * dir.x + uy * spineDir.x,
        y: shoulderTopScr.y + ux * dir.y + uy * spineDir.y,
      };
    };

    return {
      shoulderTopScr,
      widthHandleScr: keyToScreen(bladeLengthMm * 0.28, 0),
      spineAngleHandleScr: keyToScreen(bladeLengthMm * 0.82, 0),
      skewHandleScr: keyToScreen(bladeLengthMm * 0.55, bladeWidthMm),
      dir,
      spineDir,
      sSign,
      pxPerMm,
      effectiveSpineDistPx,
      keyToScreen,
    };
  }, [alignment, bladeLengthMm, bladeWidthMm, flipHorizontal, normToScreen, stageH, viewScale]);

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

    // 2. Crisp key silhouette & alignment reference lines
    const { keyToScreen, shoulderTopScr, widthHandleScr, spineAngleHandleScr, skewHandleScr } =
      keyTransform;
    const profile = computeBittingProfile(spec, cuts);
    const spacesMm = getAllSpacesMm(spec);
    const macsViolations = checkMacsViolations(spec, cuts);
    const badPins = new Set<number>();
    for (const v of macsViolations) {
      badPins.add(v.pinIndexA);
      badPins.add(v.pinIndexB);
    }

    // Blade bitting polygon
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

    // Uncut blank top reference line (helps visually lock A & H onto uncut top land!)
    const topL = keyToScreen(0, bladeWidthMm);
    const topR = keyToScreen(bladeLengthMm * 0.94, bladeWidthMm);
    ctx.beginPath();
    ctx.moveTo(topL.x, topL.y);
    ctx.lineTo(topR.x, topR.y);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top shoulder stop vertical reference line (extends up along the bow step and down across blade)
    const shLow = keyToScreen(0, -1.5);
    const shHigh = keyToScreen(0, bladeWidthMm + 4.5);
    ctx.beginPath();
    ctx.moveTo(shLow.x, shLow.y);
    ctx.lineTo(shHigh.x, shHigh.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle caliper guide connecting top uncut line down to H (blade width)
    const calTop = keyToScreen(bladeLengthMm * 0.28, bladeWidthMm);
    ctx.beginPath();
    ctx.moveTo(calTop.x, calTop.y);
    ctx.lineTo(widthHandleScr.x, widthHandleScr.y);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Highlighted straight bottom spine line
    ctx.beginPath();
    ctx.moveTo(sOrigin.x, sOrigin.y);
    ctx.lineTo(sTipBot.x, sTipBot.y);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pin vertical guides + depth tick ladders
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

    // 3. Draggable Anchor Handles: A (Top Shoulder), H (Blade Width/Scale), B (Spine Angle)
    const drawAnchor = (pt: Point2D, letter: string, color: string) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
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

    drawAnchor(shoulderTopScr, 'A', '#38bdf8');
    drawAnchor(widthHandleScr, 'H', '#facc15');
    drawAnchor(spineAngleHandleScr, 'B', '#4ade80');
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
    if (dist(pt, keyTransform.shoulderTopScr) <= hitR) mode = 'shoulder';
    else if (dist(pt, keyTransform.widthHandleScr) <= hitR) mode = 'width';
    else if (dist(pt, keyTransform.spineAngleHandleScr) <= hitR) mode = 'spineAngle';
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
      return;
    }

    if (state.mode === 'shoulder') {
      onChangeAlignment({ ...alignment, shoulderTop: screenToNorm(pt) });
      return;
    }

    if (state.mode === 'width') {
      // Perpendicular distance from A (top shoulder) down to pointer along spineDir
      const vx = pt.x - keyTransform.shoulderTopScr.x;
      const vy = pt.y - keyTransform.shoulderTopScr.y;
      const wPx = Math.max(16, vx * keyTransform.spineDir.x + vy * keyTransform.spineDir.y);
      const denom = Math.max(1, stageH * viewScale * alignment.scaleMultiplier * alignment.heightScaleMultiplier);
      const nextRatio = Math.max(0.03, Math.min(0.85, wPx / denom));
      onChangeAlignment({ ...alignment, bladeWidthRatio: Number(nextRatio.toFixed(5)) });
      return;
    }

    if (state.mode === 'spineAngle') {
      // Rotate around A so the bottom spine line (at perpendicular distance effectiveSpineDistPx) passes through pointer
      const vx = pt.x - keyTransform.shoulderTopScr.x;
      const vy = pt.y - keyTransform.shoulderTopScr.y;
      const r = Math.hypot(vx, vy);
      const wEff = keyTransform.effectiveSpineDistPx;
      if (r > wEff + 4) {
        const phi = Math.atan2(vy, vx);
        const alpha = Math.asin(Math.max(-0.999, Math.min(0.999, wEff / r)));
        const thetaVis = phi - keyTransform.sSign * alpha;
        const baseRad = flipHorizontal ? Math.PI - thetaVis : thetaVis;
        const nextAngleDeg = normalizeAngleDeg((baseRad * 180) / Math.PI - alignment.rotationOffsetDeg);
        onChangeAlignment({ ...alignment, angleDeg: nextAngleDeg });
      }
      return;
    }

    if (state.mode === 'skew') {
      const vx = pt.x - keyTransform.shoulderTopScr.x;
      const vy = pt.y - keyTransform.shoulderTopScr.y;
      const alongX = vx * keyTransform.dir.x + vy * keyTransform.dir.y;
      const expectedX = bladeLengthMm * 0.55 * keyTransform.pxPerMm;
      const denom = Math.max(10, bladeWidthMm * keyTransform.pxPerMm);
      const nextSkew = Math.max(-0.35, Math.min(0.35, (alongX - expectedX) / denom));
      onChangeAlignment({ ...alignment, skewY: Number(nextSkew.toFixed(3)) });
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

      {/* Collapsible fine-tune / image adjustments */}
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
            Skew (C)
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

      {/* Clear 3-step locksmith alignment instruction */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
        1. Drag <strong className="text-sky-600 dark:text-sky-400">A</strong> to top shoulder corner · 2. Drag{' '}
        <strong className="text-amber-600 dark:text-amber-400">H</strong> to bottom spine (scale) · 3. Drag{' '}
        <strong className="text-emerald-600 dark:text-emerald-400">B</strong> along bottom spine (angle)
      </div>
    </div>
  );
}
