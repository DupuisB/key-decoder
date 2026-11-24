import {
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Move,
  RotateCcw,
  RotateCw,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
  imageLabel: string | null;
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
  imageLabel,
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
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 460 });
  const [viewZoom, setViewZoom] = useState(1);
  const [pan, setPan] = useState<Point2D>({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(105);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [showSkewHandle, setShowSkewHandle] = useState(false);
  const [showImageControls, setShowImageControls] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.88);
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

  // Load HTMLImageElement whenever imageUrl changes
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

  // Responsive container sizing
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

  // Compute virtual stage dimensions (image natural size or default 1280x720 workspace)
  const stageW = loadedImage?.naturalWidth || 1280;
  const stageH = loadedImage?.naturalHeight || 720;

  const fitScale = Math.min((canvasSize.width * 0.94) / stageW, (canvasSize.height * 0.92) / stageH);
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

  // Derived key coordinate transform from Anchors A (shoulder) and B (tip)
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

    const skewHandleScr = keyToScreen(bladeLengthMm * 0.5, bladeWidthMm);
    const computedAngleDeg = (totalAngleRad * 180) / Math.PI;

    return {
      shoulderScr,
      tipScr,
      skewHandleScr,
      pxPerMm,
      totalAngleRad,
      computedAngleDeg,
      ySign,
      keyToScreen,
      screenToKeyLocalPx,
    };
  }, [alignment, bladeLengthMm, bladeWidthMm, normToScreen]);

  // 60fps Canvas Render
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

    // 1. Draw photo (with brightness/contrast & optional horizontal flip)
    if (loadedImage) {
      ctx.save();
      ctx.translate(centerX, centerY);
      if (flipHorizontal) ctx.scale(-1, 1);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      const drawW = stageW * viewScale;
      const drawH = stageH * viewScale;
      ctx.drawImage(loadedImage, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();
    } else {
      // Subtle engineering calibration grid when no photo is loaded
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      const step = 32;
      for (let x = 0; x < canvasSize.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvasSize.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
        ctx.stroke();
      }
    }

    // 2. Render semi-transparent vector key silhouette & bitting guides
    const { keyToScreen, shoulderScr, tipScr, skewHandleScr } = keyTransform;
    const profile = computeBittingProfile(spec, cuts);
    const spacesMm = getAllSpacesMm(spec);
    const macsViolations = checkMacsViolations(spec, cuts);
    const badPins = new Set<number>();
    for (const v of macsViolations) {
      badPins.add(v.pinIndexA);
      badPins.add(v.pinIndexB);
    }

    ctx.save();
    ctx.globalAlpha = overlayOpacity;

    // 2a. Subtle bow outline reference (dashed)
    const bow = spec.bow;
    const bowCenterY = bladeWidthMm * 0.5;
    const bowHalfH = bow.widthMm * 0.5;
    const bowOutlineMm: Point2D[] = [
      { x: 0, y: bladeWidthMm },
      { x: 0, y: bladeWidthMm + bow.shoulderTopExtraMm },
      { x: -2.0, y: bladeWidthMm + bow.shoulderTopExtraMm },
      { x: -7.5, y: bowCenterY + bowHalfH },
      { x: -bow.lengthMm, y: bowCenterY + bowHalfH - 4 },
      { x: -bow.lengthMm, y: bowCenterY - bowHalfH + 4 },
      { x: -7.5, y: bowCenterY - bowHalfH },
      { x: -2.0, y: -bow.shoulderBottomExtraMm },
      { x: 0, y: -bow.shoulderBottomExtraMm },
      { x: 0, y: 0 },
    ];

    ctx.beginPath();
    bowOutlineMm.forEach((pt, idx) => {
      const s = keyToScreen(pt.x, pt.y);
      if (idx === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);

    // 2b. Blade silhouette polygon (exact DSD bitting profile)
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

    ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 2c. Crisp shoulder stop alignment reference line at x = 0
    const shLow = keyToScreen(0, -bow.shoulderBottomExtraMm - 1.5);
    const shHigh = keyToScreen(0, bladeWidthMm + bow.shoulderTopExtraMm + 1.5);
    ctx.beginPath();
    ctx.moveTo(shLow.x, shLow.y);
    ctx.lineTo(shHigh.x, shHigh.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2d. Uncut blank top reference line (faint dashed)
    const blankL = keyToScreen(0, bladeWidthMm);
    const blankR = keyToScreen(bladeLengthMm, bladeWidthMm);
    ctx.beginPath();
    ctx.moveTo(blankL.x, blankL.y);
    ctx.lineTo(blankR.x, blankR.y);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2e. Pin vertical centerlines & factory depth tick ladders
    const tickHalfMm = Math.min(0.65, inToMm(spec.pinSpacingIn) * 0.18);

    for (let i = 0; i < spec.pinCount; i++) {
      const cxMm = spacesMm[i]!;
      const cutVal = cuts[i] ?? spec.depthMin;
      const isFocused = activePinIndex === i;
      const isBad = badPins.has(i);

      const lineBot = keyToScreen(cxMm, -0.8);
      const lineTop = keyToScreen(cxMm, bladeWidthMm + 1.4);

      ctx.beginPath();
      ctx.moveTo(lineBot.x, lineBot.y);
      ctx.lineTo(lineTop.x, lineTop.y);
      ctx.strokeStyle = isBad
        ? 'rgba(239, 68, 68, 0.8)'
        : isFocused
          ? 'rgba(56, 189, 248, 0.95)'
          : 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = isFocused ? 1.8 : 1.1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Depth tick marks from depthMin to depthMax
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
            : '#22d3ee'
          : 'rgba(226, 232, 240, 0.48)';
        ctx.lineWidth = isCurrent ? 2.5 : 1;
        ctx.stroke();
      }

      // Active cut highlight dot
      const cutPt = keyToScreen(cxMm, getRootDepthMm(spec, cutVal));
      ctx.beginPath();
      ctx.arc(cutPt.x, cutPt.y, isFocused ? 4.8 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = isBad ? '#ef4444' : '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Pin number & depth badge above blade (compact font on narrow mobile screens)
      const isCompact = keyTransform.pxPerMm < 8.5;
      const labelPt = keyToScreen(cxMm, bladeWidthMm + (isCompact ? 3.2 : 2.6));
      const badgeText = isCompact ? `${cutVal}` : `${i + 1}:${cutVal}`;
      ctx.font = isCompact
        ? '700 10px ui-monospace, SFMono-Regular, monospace'
        : '700 11px ui-monospace, SFMono-Regular, monospace';
      const tw = ctx.measureText(badgeText).width;
      const bw = tw + (isCompact ? 7 : 10);
      const bh = isCompact ? 15 : 18;
      ctx.fillStyle = isBad
        ? 'rgba(185, 28, 28, 0.92)'
        : isFocused
          ? 'rgba(14, 116, 144, 0.96)'
          : 'rgba(9, 9, 11, 0.82)';
      ctx.beginPath();
      ctx.roundRect(labelPt.x - bw / 2, labelPt.y - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = isBad ? '#fca5a5' : isFocused ? '#38bdf8' : 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, labelPt.x, labelPt.y + 0.5);
    }

    ctx.restore();

    // 3. Draw Draggable Anchor Handles (A = Shoulder, B = Tip, optional C = Width/Skew)
    const drawHandle = (pt: Point2D, label: string, color: string, subtitle: string) => {
      // Outer halo
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(9, 9, 11, 0.55)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(pt.x - 18, pt.y);
      ctx.lineTo(pt.x - 6, pt.y);
      ctx.moveTo(pt.x + 6, pt.y);
      ctx.lineTo(pt.x + 18, pt.y);
      ctx.moveTo(pt.x, pt.y - 18);
      ctx.lineTo(pt.x, pt.y - 6);
      ctx.moveTo(pt.x, pt.y + 6);
      ctx.lineTo(pt.x, pt.y + 18);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Tag pill
      ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
      const tag = `${label} · ${subtitle}`;
      const tw = ctx.measureText(tag).width;
      const pillX = pt.x - (tw + 12) / 2;
      const pillY = pt.y + 20;
      ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, tw + 12, 18, 5);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, pt.x, pillY + 9.5);
    };

    drawHandle(shoulderScr, 'A', '#38bdf8', 'Shoulder');
    drawHandle(tipScr, 'B', '#34d399', 'Tip');
    if (showSkewHandle) {
      drawHandle(skewHandleScr, 'C', '#c084fc', 'Width/Skew');
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
    overlayOpacity,
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

    const hitR = 24;
    const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

    let mode: DragMode = 'pan';
    if (dist(pt, keyTransform.shoulderScr) <= hitR) {
      mode = 'shoulder';
    } else if (dist(pt, keyTransform.tipScr) <= hitR) {
      mode = 'tip';
    } else if (showSkewHandle && dist(pt, keyTransform.skewHandleScr) <= hitR) {
      mode = 'skew';
    }

    dragStateRef.current = {
      mode,
      startScreen: pt,
      startPan: { ...pan },
      moved: false,
    };
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
      const norm = screenToNorm(pt);
      onChangeAlignment({ ...alignment, shoulder: norm });
      return;
    }

    if (state.mode === 'tip') {
      const norm = screenToNorm(pt);
      onChangeAlignment({ ...alignment, tip: norm });
      return;
    }

    if (state.mode === 'skew') {
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
      // Allow clicking directly on a pin's depth ladder to snap cut depth!
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
    if (file && file.type.startsWith('image/')) {
      onUploadFile(file);
    }
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/70">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Upload Photo
          </button>

          <button
            type="button"
            data-testid="load-sample-btn"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Load Sample Key
          </button>

          {imageLabel && (
            <span className="hidden max-w-[180px] truncate font-mono text-[11px] text-zinc-500 sm:inline dark:text-zinc-400">
              {imageLabel}
            </span>
          )}
        </div>

        {/* View & Flip Controls */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setViewZoom((z) => Math.max(0.4, Number((z / 1.15).toFixed(3))))}
            title="Zoom out"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[42px] text-center font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
            {Math.round(viewZoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setViewZoom((z) => Math.min(6, Number((z * 1.15).toFixed(3))))}
            title="Zoom in"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="flip-horizontal-btn"
            onClick={() => setFlipHorizontal((f) => !f)}
            title="Flip photo horizontally (left/right facing key)"
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
              flipHorizontal
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Flip H</span>
          </button>

          <button
            type="button"
            data-testid="flip-vertical-btn"
            onClick={() => onChangeAlignment({ ...alignment, flipVertical: !alignment.flipVertical })}
            title="Flip teeth side (up vs. down)"
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
              alignment.flipVertical
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
            }`}
          >
            <FlipVertical2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Teeth Side</span>
          </button>

          <button
            type="button"
            data-testid="toggle-skew-handle-btn"
            onClick={() => setShowSkewHandle((s) => !s)}
            title="Toggle 3rd anchor handle (C) for blade width & perspective skew compensation"
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
              showSkewHandle
                ? 'border-purple-500/60 bg-purple-500/15 text-purple-700 dark:text-purple-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
            }`}
          >
            <Move className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Skew (C)</span>
          </button>

          <button
            type="button"
            data-testid="toggle-image-filters-btn"
            onClick={() => setShowImageControls((s) => !s)}
            title="Brightness, contrast, and overlay opacity"
            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
              showImageControls
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adjust</span>
          </button>
        </div>
      </div>

      {/* Collapsible Photo Brightness / Contrast / Overlay Opacity Strip */}
      {showImageControls && (
        <div
          data-testid="image-filters-bar"
          className="grid grid-cols-1 gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950/60"
        >
          <label className="flex items-center gap-2">
            <span className="w-18 text-zinc-500">Brightness</span>
            <input
              type="range"
              min={50}
              max={180}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer"
            />
            <span className="w-9 text-right font-mono">{brightness}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-18 text-zinc-500">Contrast</span>
            <input
              type="range"
              min={50}
              max={200}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer"
            />
            <span className="w-9 text-right font-mono">{contrast}%</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-18 text-zinc-500">Overlay</span>
            <input
              type="range"
              min={25}
              max={100}
              value={Math.round(overlayOpacity * 100)}
              onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
              className="h-1.5 flex-1 cursor-pointer"
            />
            <span className="w-9 text-right font-mono">{Math.round(overlayOpacity * 100)}%</span>
          </label>
        </div>
      )}

      {/* Main Interactive Canvas Surface */}
      <div
        ref={containerRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`checker-bg relative h-[360px] w-full select-none overflow-hidden sm:h-[440px] lg:h-[480px] ${
          isDragOver ? 'ring-2 ring-amber-500 ring-inset' : ''
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

        {/* Subtle empty-state helper overlay when no photo uploaded yet */}
        {!loadedImage && (
          <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-center">
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border border-zinc-300/80 bg-white/90 px-3 py-1.5 text-xs text-zinc-700 shadow-sm backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-zinc-300">
              <span>Drop a key photo here, upload one, or click</span>
              <button
                type="button"
                onClick={onLoadSample}
                className="font-semibold text-amber-600 underline underline-offset-2 hover:text-amber-500 dark:text-amber-400"
              >
                Load Sample Key
              </button>
              <span>to test alignment immediately.</span>
            </div>
          </div>
        )}

        {/* Live Scale & Angle Telemetry Chip */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-2 rounded-md border border-zinc-700/70 bg-zinc-950/80 px-2.5 py-1 font-mono text-[10px] text-zinc-200 backdrop-blur-xs">
          <span className="flex items-center gap-1 text-sky-400">
            <Crosshair className="h-3 w-3" />
            {keyTransform.computedAngleDeg.toFixed(1)}°
          </span>
          <span className="text-zinc-500">|</span>
          <span>{keyTransform.pxPerMm.toFixed(1)} px/mm</span>
          {showSkewHandle && (
            <>
              <span className="text-zinc-500">|</span>
              <span className="text-purple-300">
                H:{Math.round(alignment.heightScaleMultiplier * 100)}% Skew:{alignment.skewY.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Precision Fine-Tune Alignment Nudge Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950/60">
        <span className="text-zinc-500 dark:text-zinc-400">
          Drag <strong className="text-sky-600 dark:text-sky-400">A (Shoulder)</strong> &amp;{' '}
          <strong className="text-emerald-600 dark:text-emerald-400">B (Tip)</strong> to lock scale · Click depth ticks
          or use steppers
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Rotation ±0.5° */}
          <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              data-testid="nudge-rot-minus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  rotationOffsetDeg: Number((alignment.rotationOffsetDeg - 0.5).toFixed(1)),
                })
              }
              title="Rotate -0.5°"
              className="inline-flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3 w-3" />
              0.5°
            </button>
            <span className="border-x border-zinc-200 px-1.5 py-1 font-mono text-[10px] text-zinc-500 dark:border-zinc-700">
              {alignment.rotationOffsetDeg >= 0 ? '+' : ''}
              {alignment.rotationOffsetDeg.toFixed(1)}°
            </span>
            <button
              type="button"
              data-testid="nudge-rot-plus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  rotationOffsetDeg: Number((alignment.rotationOffsetDeg + 0.5).toFixed(1)),
                })
              }
              title="Rotate +0.5°"
              className="inline-flex items-center gap-0.5 px-2 py-1 font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              0.5°
              <RotateCw className="h-3 w-3" />
            </button>
          </div>

          {/* Scale ±0.5% */}
          <div className="inline-flex items-center rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              data-testid="nudge-scale-minus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  scaleMultiplier: Math.max(0.5, Number((alignment.scaleMultiplier - 0.005).toFixed(4))),
                })
              }
              title="Scale -0.5%"
              className="px-2 py-1 font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              −0.5%
            </button>
            <span className="border-x border-zinc-200 px-1.5 py-1 font-mono text-[10px] text-zinc-500 dark:border-zinc-700">
              {(alignment.scaleMultiplier * 100).toFixed(1)}%
            </span>
            <button
              type="button"
              data-testid="nudge-scale-plus"
              onClick={() =>
                onChangeAlignment({
                  ...alignment,
                  scaleMultiplier: Math.min(1.6, Number((alignment.scaleMultiplier + 0.005).toFixed(4))),
                })
              }
              title="Scale +0.5%"
              className="px-2 py-1 font-mono text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              +0.5%
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setViewZoom(1);
              setPan({ x: 0, y: 0 });
              onChangeAlignment({
                ...alignment,
                rotationOffsetDeg: 0,
                scaleMultiplier: 1,
                heightScaleMultiplier: 1,
                skewY: 0,
              });
            }}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
