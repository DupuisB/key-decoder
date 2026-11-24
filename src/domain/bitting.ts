import { inToMm, mmToIn } from './keyways';
import type { CustomKeywayInput, KeywaySpec, MacsViolation, Point2D } from './types';

export function getRootDepthIn(spec: KeywaySpec, depthCode: number): number {
  const clamped = Math.max(spec.depthMin, Math.min(spec.depthMax, Math.round(depthCode)));
  const idx = clamped - spec.depthMin;
  const val = spec.rootDepthsIn[idx];
  if (val !== undefined) return val;
  const fallback = spec.rootDepthsIn[0] ?? spec.bladeWidthIn;
  return fallback - idx * spec.depthStepIn;
}

export function getRootDepthMm(spec: KeywaySpec, depthCode: number): number {
  return inToMm(getRootDepthIn(spec, depthCode));
}

export function getSpaceMm(spec: KeywaySpec, pinIndex: number): number {
  const val = spec.spacesIn[pinIndex];
  if (val !== undefined) return inToMm(val);
  return inToMm(spec.firstCutIn + pinIndex * spec.pinSpacingIn);
}

export function getAllSpacesMm(spec: KeywaySpec): number[] {
  return Array.from({ length: spec.pinCount }, (_, i) => getSpaceMm(spec, i));
}

export function clampCutsToSpec(spec: KeywaySpec, cuts: readonly number[]): number[] {
  return Array.from({ length: spec.pinCount }, (_, i) => {
    const raw = cuts[i] ?? spec.defaultCuts[i] ?? spec.depthMin;
    return Math.max(spec.depthMin, Math.min(spec.depthMax, Math.round(raw)));
  });
}

export function formatBittingCode(cuts: readonly number[], separator = '-'): string {
  return cuts.join(separator);
}

export function checkMacsViolations(spec: KeywaySpec, cuts: readonly number[]): MacsViolation[] {
  const violations: MacsViolation[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (a === undefined || b === undefined) continue;
    const delta = Math.abs(a - b);
    if (delta > spec.macs) {
      violations.push({
        pinIndexA: i,
        pinIndexB: i + 1,
        delta,
        macs: spec.macs,
      });
    }
  }
  return violations;
}

interface LinearSegment {
  x0: number;
  x1: number;
  /** y(x) = m * x + b */
  m: number;
  b: number;
}

function evalSegment(seg: LinearSegment, x: number): number {
  return seg.m * x + seg.b;
}

/**
 * Evaluates the exact lower-envelope top bitting curve H(x) in millimeters
 * over x in [0, bladeLengthMm].
 *
 * At every pin center x_i (when MACS is satisfied), H(x_i) === rootDepthMm(cut_i)
 * to full IEEE-754 floating-point precision.
 */
export function computeBittingProfile(spec: KeywaySpec, rawCuts: readonly number[]): Point2D[] {
  const cuts = clampCutsToSpec(spec, rawCuts);
  const bladeLengthMm = inToMm(spec.bladeLengthIn);
  const bladeWidthMm = inToMm(spec.bladeWidthIn);
  const cutFlatMm = inToMm(spec.cutFlatIn);
  const halfFlat = cutFlatMm / 2;
  const halfAngleRad = ((spec.cutAngleDeg / 2) * Math.PI) / 180;
  const slope = 1 / Math.tan(halfAngleRad); // rise per mm of run

  const tipBevelLengthMm = Math.min(inToMm(spec.tipBevelLengthIn), bladeLengthMm * 0.25);
  const tipBevelHeightMm = Math.min(inToMm(spec.tipBevelHeightIn), bladeWidthMm * 0.58);
  const tipStartX = bladeLengthMm - tipBevelLengthMm;
  const tipSlope = -tipBevelHeightMm / Math.max(tipBevelLengthMm, 1e-4);

  // Build piecewise linear ceiling functions (each returns height at x)
  type CeilingFn = (x: number) => number;
  const fns: CeilingFn[] = [];
  const segments: LinearSegment[] = [];

  // 1. Blank top edge
  fns.push(() => bladeWidthMm);
  segments.push({ x0: 0, x1: bladeLengthMm, m: 0, b: bladeWidthMm });

  // 2. Tip bevel ramp
  fns.push((x) => (x <= tipStartX ? bladeWidthMm : bladeWidthMm + tipSlope * (x - tipStartX)));
  segments.push({
    x0: tipStartX,
    x1: bladeLengthMm,
    m: tipSlope,
    b: bladeWidthMm - tipSlope * tipStartX,
  });

  // 3. Each pin V-cut (left ramp, flat root, right ramp)
  const pinCenters: number[] = [];
  for (let i = 0; i < spec.pinCount; i++) {
    const cx = getSpaceMm(spec, i);
    const cy = getRootDepthMm(spec, cuts[i] ?? spec.depthMin);
    pinCenters.push(cx);

    const xL = cx - halfFlat;
    const xR = cx + halfFlat;

    fns.push((x) => {
      if (x < xL) return cy + slope * (xL - x);
      if (x > xR) return cy + slope * (x - xR);
      return cy;
    });

    // Left ramp: y = -slope * x + (cy + slope * xL)
    segments.push({ x0: 0, x1: xL, m: -slope, b: cy + slope * xL });
    // Flat bottom: y = cy
    segments.push({ x0: xL, x1: xR, m: 0, b: cy });
    // Right ramp: y = slope * x + (cy - slope * xR)
    segments.push({ x0: xR, x1: bladeLengthMm, m: slope, b: cy - slope * xR });
  }

  // Collect all critical X breakpoints
  const xs: number[] = [0, bladeLengthMm, tipStartX];
  for (const seg of segments) {
    if (seg.x0 > 0 && seg.x0 < bladeLengthMm) xs.push(seg.x0);
    if (seg.x1 > 0 && seg.x1 < bladeLengthMm) xs.push(seg.x1);
  }
  for (const cx of pinCenters) {
    if (cx > 0 && cx < bladeLengthMm) xs.push(cx);
  }

  // Pairwise segment intersections inside (0, bladeLengthMm)
  for (let i = 0; i < segments.length; i++) {
    const s1 = segments[i]!;
    for (let j = i + 1; j < segments.length; j++) {
      const s2 = segments[j]!;
      const dm = s1.m - s2.m;
      if (Math.abs(dm) < 1e-9) continue;
      const ix = (s2.b - s1.b) / dm;
      if (
        ix > Math.max(0, s1.x0, s2.x0) - 1e-6 &&
        ix < Math.min(bladeLengthMm, s1.x1, s2.x1) + 1e-6 &&
        ix > 1e-6 &&
        ix < bladeLengthMm - 1e-6
      ) {
        xs.push(ix);
      }
    }
  }

  xs.sort((a, b) => a - b);

  // Deduplicate X values within 1e-5 mm
  const uniqueXs: number[] = [];
  for (const x of xs) {
    const prev = uniqueXs[uniqueXs.length - 1];
    if (prev === undefined || x - prev > 1e-5) {
      uniqueXs.push(x);
    }
  }

  // Evaluate lower envelope at each X (clamped above safe structural floor)
  const minSafeHeightMm = Math.max(1.2, bladeWidthMm * 0.16);
  const evalY = (x: number): number => {
    let minY = bladeWidthMm;
    for (const fn of fns) {
      const y = fn(x);
      if (y < minY) minY = y;
    }
    return Math.max(minSafeHeightMm, minY);
  };

  const rawPoints: Point2D[] = uniqueXs.map((x) => ({ x, y: evalY(x) }));

  // Remove collinear redundant points while preserving pin center flat corners
  const simplified: Point2D[] = [];
  for (let i = 0; i < rawPoints.length; i++) {
    const curr = rawPoints[i]!;
    if (i === 0 || i === rawPoints.length - 1) {
      simplified.push(curr);
      continue;
    }
    const prev = simplified[simplified.length - 1]!;
    const next = rawPoints[i + 1]!;
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
    const scale = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2);
    if (scale > 0 && cross / scale > 1e-5) {
      simplified.push(curr);
    }
  }

  // Ensure endpoints remain exact
  if (simplified.length < 2) {
    return [
      { x: 0, y: bladeWidthMm },
      { x: bladeLengthMm, y: Math.max(minSafeHeightMm, bladeWidthMm - tipBevelHeightMm) },
    ];
  }

  // Avoid unused helper warning
  void evalSegment;
  return simplified;
}

/**
 * Evaluate the height H(x) at any x in [0, bladeLengthMm] along a precomputed profile polyline.
 */
export function sampleProfileHeight(profile: readonly Point2D[], x: number): number {
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (!first || !last) return 0;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;

  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    if (x >= a.x - 1e-9 && x <= b.x + 1e-9) {
      const span = b.x - a.x;
      if (span < 1e-9) return a.y;
      const t = Math.max(0, Math.min(1, (x - a.x) / span));
      return a.y + t * (b.y - a.y);
    }
  }
  return last.y;
}

/**
 * Build a full KeywaySpec from user-supplied Custom Keyway Mode parameters (in mm or inches).
 */
export function buildCustomKeywaySpec(input: CustomKeywayInput): KeywaySpec {
  const toIn = (v: number) => (input.unit === 'mm' ? mmToIn(v) : v);

  const spacesIn = input.spaces
    .map(toIn)
    .filter((v) => Number.isFinite(v) && v > 0.05)
    .sort((a, b) => a - b);

  const rootDepthsIn = input.rootDepths
    .map(toIn)
    .filter((v) => Number.isFinite(v) && v > 0.05);

  const safeSpaces = spacesIn.length >= 2 ? spacesIn : [0.237, 0.393, 0.549, 0.705, 0.861];
  const safeDepths =
    rootDepthsIn.length >= 2
      ? rootDepthsIn
      : [0.315, 0.297, 0.279, 0.261, 0.243, 0.225, 0.207, 0.189, 0.171, 0.153];

  const firstCutIn = safeSpaces[0]!;
  const pinSpacingIn =
    safeSpaces.length > 1
      ? Number(((safeSpaces[safeSpaces.length - 1]! - firstCutIn) / (safeSpaces.length - 1)).toFixed(4))
      : 0.156;
  const depthStepIn =
    safeDepths.length > 1
      ? Number(
          (
            Math.abs(safeDepths[0]! - safeDepths[safeDepths.length - 1]!) /
            (safeDepths.length - 1)
          ).toFixed(4),
        )
      : 0.018;

  const maxRoot = Math.max(...safeDepths);
  const bladeWidthIn = Math.max(toIn(input.bladeWidth), maxRoot + 0.005);
  const lastSpace = safeSpaces[safeSpaces.length - 1]!;
  const bladeLengthIn = Math.max(toIn(input.bladeLength), lastSpace + 0.14);
  const bladeThicknessIn = Math.max(0.05, Math.min(0.14, toIn(input.bladeThickness)));
  const cutFlatIn = Math.max(0.015, Math.min(0.10, toIn(input.cutFlat)));
  const cutAngleDeg = Math.max(60, Math.min(125, input.cutAngleDeg));

  const depthMin = Math.round(input.depthMin);
  const depthMax = depthMin + safeDepths.length - 1;
  const midDepth = Math.round((depthMin + depthMax) / 2);

  return {
    id: 'CUSTOM',
    code: 'CUSTOM',
    name: input.name.trim() || 'Custom Keyway',
    manufacturer: 'Custom',
    ilcoRef: 'Custom',
    dsdRef: `User DSD (${input.unit})`,
    category: 'custom',
    description: 'User-defined custom spacing and root depth specification.',
    pinCount: safeSpaces.length,
    depthMin,
    depthMax,
    macs: Math.max(1, Math.min(safeDepths.length, Math.round(input.macs))),
    firstCutIn,
    pinSpacingIn,
    spacesIn: safeSpaces,
    depthStepIn,
    rootDepthsIn: safeDepths,
    bladeWidthIn,
    bladeLengthIn,
    bladeThicknessIn,
    cutFlatIn,
    cutAngleDeg,
    tipBevelLengthIn: 0.12,
    tipBevelHeightIn: bladeWidthIn * 0.42,
    defaultCuts: safeSpaces.map((_, i) =>
      Math.max(depthMin, Math.min(depthMax, midDepth + ((i % 3) - 1))),
    ),
    bow: {
      lengthMm: 23.5,
      widthMm: 24.0,
      holeRadiusMm: 2.8,
      holeCenterXMm: -17.8,
      shoulderTopExtraMm: 3.4,
      shoulderBottomExtraMm: 2.8,
    },
    warding: [
      { side: 'top', yStartRatio: 0.22, yEndRatio: 0.48, depthRatio: 0.28, chamferMm: 0.32 },
      { side: 'bottom', yStartRatio: 0.36, yEndRatio: 0.62, depthRatio: 0.24, chamferMm: 0.32 },
    ],
  };
}
