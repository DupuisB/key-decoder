import { clampCutsToSpec, computeBittingProfile, sampleProfileHeight } from '../domain/bitting';
import { inToMm } from '../domain/keyways';
import type { KeywaySpec, Point2D, PrintOptions, WardingGroove } from '../domain/types';
import { type IndexedPoint2D, triangulatePolygonWithHole } from './triangulate';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface ManifoldMesh {
  /** Flat array of 3D vertices: [x0, y0, z0, x1, y1, z1, ...] in millimeters */
  vertices: Float32Array;
  /** Flat array of triangle indices: [a0, b0, c0, ...] oriented outward (CCW from outside) */
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  bounds: BoundingBox3D;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  bladeThicknessScale: 0.98,
  reinforcedBow: false,
  bowExtraThicknessMm: 0.8,
  includeWarding: true,
};

interface ResolvedGroove {
  side: 'top' | 'bottom';
  y0: number;
  y0Inner: number;
  y1Inner: number;
  y1: number;
  depthMm: number;
}

function resolveGrooves(
  warding: readonly WardingGroove[],
  bladeWidthMm: number,
  bladeThicknessMm: number,
): ResolvedGroove[] {
  const result: ResolvedGroove[] = [];
  for (const g of warding) {
    const y0 = Math.max(0.45, Math.min(bladeWidthMm - 0.8, g.yStartRatio * bladeWidthMm));
    const y1 = Math.max(y0 + 0.5, Math.min(bladeWidthMm - 0.35, g.yEndRatio * bladeWidthMm));
    const maxChamfer = (y1 - y0) * 0.35;
    const ch = Math.max(0.08, Math.min(g.chamferMm, maxChamfer));
    const depthMm = Math.max(0.12, Math.min(bladeThicknessMm * 0.38, g.depthRatio * bladeThicknessMm));
    result.push({
      side: g.side,
      y0,
      y0Inner: y0 + ch,
      y1Inner: y1 - ch,
      y1,
      depthMm,
    });
  }
  return result;
}

function evalGrooveDepthAtY(groove: ResolvedGroove, y: number): number {
  if (y <= groove.y0 || y >= groove.y1) return 0;
  if (y < groove.y0Inner) {
    return groove.depthMm * ((y - groove.y0) / (groove.y0Inner - groove.y0));
  }
  if (y > groove.y1Inner) {
    return groove.depthMm * ((groove.y1 - y) / (groove.y1 - groove.y1Inner));
  }
  return groove.depthMm;
}

function dedupSorted(values: number[], tol = 1e-4): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    const prev = out[out.length - 1];
    if (prev === undefined || v - prev > tol) {
      out.push(v);
    }
  }
  return out;
}

function sampleRoundedBowOuter(
  spec: KeywaySpec,
  bladeWidthMm: number,
  shoulderCol: readonly IndexedPoint2D[],
  addVertex: (x: number, y: number) => IndexedPoint2D,
): IndexedPoint2D[] {
  const bow = spec.bow;
  const centerY = bladeWidthMm * 0.5;
  const halfH = bow.widthMm * 0.5;
  const topY = centerY + halfH;
  const botY = centerY - halfH;
  const backX = -bow.lengthMm;
  const cornerR = Math.min(5.2, halfH * 0.48, bow.lengthMm * 0.25);

  const outer: IndexedPoint2D[] = [];

  // 1. Walk UP the exact shared shoulder interface x = 0 from y = 0 to y = H(0)
  for (const pt of shoulderCol) {
    outer.push(pt);
  }

  const shoulderTopY = Math.max(bladeWidthMm + bow.shoulderTopExtraMm, (shoulderCol[shoulderCol.length - 1]?.y ?? bladeWidthMm) + 1.0);
  const shoulderBotY = -bow.shoulderBottomExtraMm;

  // 2. Upper shoulder stop & transition neck
  outer.push(addVertex(0, shoulderTopY));
  outer.push(addVertex(-1.6, shoulderTopY));
  outer.push(addVertex(-4.2, shoulderTopY + (topY - shoulderTopY) * 0.55));
  outer.push(addVertex(-7.5, topY));

  // 3. Top-left rounded bow corner (quarter circle from 90° to 180°)
  const arcSteps = 5;
  const tlCx = backX + cornerR;
  const tlCy = topY - cornerR;
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI * 0.5 + (Math.PI * 0.5 * i) / arcSteps;
    outer.push(addVertex(tlCx + Math.cos(a) * cornerR, tlCy + Math.sin(a) * cornerR));
  }

  // 4. Bottom-left rounded bow corner (quarter circle from 180° to 270°)
  const blCx = backX + cornerR;
  const blCy = botY + cornerR;
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI + (Math.PI * 0.5 * i) / arcSteps;
    outer.push(addVertex(blCx + Math.cos(a) * cornerR, blCy + Math.sin(a) * cornerR));
  }

  // 5. Lower transition neck & bottom shoulder stop
  outer.push(addVertex(-7.5, botY));
  outer.push(addVertex(-4.2, shoulderBotY + (botY - shoulderBotY) * 0.55));
  outer.push(addVertex(-1.6, shoulderBotY));
  outer.push(addVertex(0, shoulderBotY));

  return outer;
}

/**
 * Generates a provably watertight, closed, orientable genus-1 2-manifold 3D key mesh
 * with millimeter-accurate DSD bitting cuts, warding grooves, shoulder stops,
 * rounded bow with keyring hole, and tip bevel.
 */
export function buildKeyMesh(
  spec: KeywaySpec,
  rawCuts: readonly number[],
  options: Partial<PrintOptions> = {},
): ManifoldMesh {
  const opts: PrintOptions = { ...DEFAULT_PRINT_OPTIONS, ...options };
  const cuts = clampCutsToSpec(spec, rawCuts);

  const bladeLengthMm = inToMm(spec.bladeLengthIn);
  const bladeWidthMm = inToMm(spec.bladeWidthIn);
  const scale = Math.max(0.8, Math.min(1.2, opts.bladeThicknessScale));
  const bladeThicknessMm = inToMm(spec.bladeThicknessIn) * scale;
  const bowThicknessMm = opts.reinforcedBow
    ? bladeThicknessMm + Math.max(0.2, Math.min(2.5, opts.bowExtraThicknessMm))
    : bladeThicknessMm;

  const profile: Point2D[] = computeBittingProfile(spec, cuts);
  const grooves = opts.includeWarding ? resolveGrooves(spec.warding, bladeWidthMm, bladeThicknessMm) : [];

  // 1. Collect all horizontal Y levels for groove edges + spine y = 0
  const rawYLevels: number[] = [0];
  for (const g of grooves) {
    rawYLevels.push(g.y0, g.y0Inner, g.y1Inner, g.y1);
  }
  const yLevels = dedupSorted(rawYLevels, 1e-3);

  // 2. Collect all X breakpoints along blade [0, bladeLengthMm]
  const grooveRunoutMm = Math.min(1.2, bladeLengthMm * 0.08);
  const tipZBevelMm = Math.min(1.5, bladeLengthMm * 0.08);
  const rawXBreaks: number[] = [0, grooveRunoutMm, bladeLengthMm - tipZBevelMm, bladeLengthMm];

  for (const p of profile) {
    rawXBreaks.push(p.x);
  }

  // Exact crossings of piecewise-linear top curve H(x) with every horizontal groove level y_m
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i]!;
    const b = profile[i + 1]!;
    const dy = b.y - a.y;
    if (Math.abs(dy) < 1e-7) continue;
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (const yL of yLevels) {
      if (yL > minY + 1e-6 && yL < maxY - 1e-6) {
        const t = (yL - a.y) / dy;
        const ix = a.x + t * (b.x - a.x);
        if (ix > 1e-5 && ix < bladeLengthMm - 1e-5) {
          rawXBreaks.push(ix);
        }
      }
    }
  }

  const xBreaks = dedupSorted(rawXBreaks, 1e-4);

  // 3. Allocate shared 2D vertices pool
  const pts2D: Point2D[] = [];
  const addVertex = (x: number, y: number): IndexedPoint2D => {
    const index = pts2D.length;
    pts2D.push({ x, y });
    return { x, y, index };
  };

  // Build vertex columns for each x in xBreaks
  const columns: IndexedPoint2D[][] = [];
  for (const x of xBreaks) {
    const h = sampleProfileHeight(profile, x);
    const col: IndexedPoint2D[] = [];
    for (const yL of yLevels) {
      if (yL < h - 1e-3) {
        col.push(addVertex(x, yL));
      }
    }
    col.push(addVertex(x, h));
    columns.push(col);
  }

  // 4. Triangulate blade strips (strictly CCW, vertex-matched across adjacent strips)
  const tris2D: [number, number, number][] = [];

  for (let k = 0; k < columns.length - 1; k++) {
    const left = columns[k]!;
    const right = columns[k + 1]!;
    // Both columns share yLevels up to min(left.length, right.length) - 2 strictly below top,
    // and then the top cell connects the remaining top vertices.
    const sharedBandCount = Math.min(left.length, right.length) - 1;

    for (let j = 0; j < sharedBandCount; j++) {
      const a = left[j]!.index;
      const b = right[j]!.index;
      const c = right[j + 1]!.index;
      const d = left[j + 1]!.index;
      tris2D.push([a, b, c]);
      tris2D.push([a, c, d]);
    }

    // Fan any extra vertices on the taller column at the top of the strip
    if (right.length > left.length) {
      const apex = left[left.length - 1]!.index;
      for (let r = sharedBandCount; r < right.length - 1; r++) {
        tris2D.push([apex, right[r]!.index, right[r + 1]!.index]);
      }
    } else if (left.length > right.length) {
      const apex = right[right.length - 1]!.index;
      for (let r = sharedBandCount; r < left.length - 1; r++) {
        tris2D.push([left[r]!.index, apex, left[r + 1]!.index]);
      }
    }
  }

  // 5. Build & triangulate bow with circular keyring hole, sharing column[0] along x = 0
  const shoulderCol = columns[0]!;
  const bowOuter = sampleRoundedBowOuter(spec, bladeWidthMm, shoulderCol, addVertex);

  const bowCenterY = bladeWidthMm * 0.5;
  const holeSegments = 24;
  const holeCW: IndexedPoint2D[] = [];
  for (let i = 0; i < holeSegments; i++) {
    // CW order (decreasing angle)
    const angle = -(Math.PI * 2 * i) / holeSegments;
    const hx = spec.bow.holeCenterXMm + Math.cos(angle) * spec.bow.holeRadiusMm;
    const hy = bowCenterY + Math.sin(angle) * spec.bow.holeRadiusMm;
    holeCW.push(addVertex(hx, hy));
  }

  const bowTris = triangulatePolygonWithHole(bowOuter, holeCW);
  for (const t of bowTris) {
    tris2D.push(t);
  }

  // 6. Continuous Z-heightfield evaluation for top (+Z) and bottom (-Z) surfaces
  // Bottom sits flat on z = 0 (3D printer build plate) for the bow and ungrooved blade lands.
  const minCoreThicknessMm = Math.max(0.55, bladeThicknessMm * 0.3);

  const evalZ = (x: number, y: number): { zBot: number; zTop: number } => {
    if (x <= 0) {
      // Smooth ramp from bowThicknessMm (x <= -1.6) to bladeThicknessMm (x = 0)
      const rampT = Math.max(0, Math.min(1, -x / 1.6));
      return {
        zBot: 0,
        zTop: bladeThicknessMm + rampT * (bowThicknessMm - bladeThicknessMm),
      };
    }

    // Groove runout factor: 0 at shoulder (x = 0) -> 1 at x >= grooveRunoutMm
    const runout = Math.max(0, Math.min(1, x / grooveRunoutMm));

    let topGrooveDepth = 0;
    let botGrooveDepth = 0;
    for (const g of grooves) {
      const d = evalGrooveDepthAtY(g, y) * runout;
      if (g.side === 'top') {
        if (d > topGrooveDepth) topGrooveDepth = d;
      } else {
        if (d > botGrooveDepth) botGrooveDepth = d;
      }
    }

    let zBot = botGrooveDepth;
    let zTop = bladeThicknessMm - topGrooveDepth;

    // Guarantee minimum solid core thickness everywhere
    if (zTop - zBot < minCoreThicknessMm) {
      const mid = (zTop + zBot) * 0.5;
      zBot = Math.max(0, mid - minCoreThicknessMm * 0.5);
      zTop = zBot + minCoreThicknessMm;
    }

    // Subtle tip Z-bevel over last tipZBevelMm for smooth cylinder entry
    if (x > bladeLengthMm - tipZBevelMm) {
      const t = Math.max(0, Math.min(1, (x - (bladeLengthMm - tipZBevelMm)) / tipZBevelMm));
      const mid = (zBot + zTop) * 0.5;
      const halfSpan = (zTop - zBot) * 0.5;
      const minTipHalf = Math.min(halfSpan, Math.max(0.24, bladeThicknessMm * 0.18));
      const nextHalf = halfSpan + t * (minTipHalf - halfSpan);
      zBot = Math.max(0, mid - nextHalf);
      zTop = mid + nextHalf;
    }

    return { zBot, zTop };
  };

  // 7. Lift 2D vertices to 3D (bot: 0..N-1, top: N..2N-1)
  const n2D = pts2D.length;
  const vertices = new Float32Array(n2D * 2 * 3);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < n2D; i++) {
    const p = pts2D[i]!;
    const { zBot, zTop } = evalZ(p.x, p.y);

    // Bottom vertex
    const bi = i * 3;
    vertices[bi] = p.x;
    vertices[bi + 1] = p.y;
    vertices[bi + 2] = zBot;

    // Top vertex
    const ti = (n2D + i) * 3;
    vertices[ti] = p.x;
    vertices[ti + 1] = p.y;
    vertices[ti + 2] = zTop;

    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (zBot < minZ) minZ = zBot;
    if (zTop > maxZ) maxZ = zTop;
  }

  // 8. Find all unpaired 2D boundary half-edges for side walls
  const edgeKey = (u: number, v: number) => `${u}:${v}`;
  const halfEdgeSet = new Set<string>();
  const allHalfEdges: [number, number][] = [];

  for (const [a, b, c] of tris2D) {
    halfEdgeSet.add(edgeKey(a, b));
    halfEdgeSet.add(edgeKey(b, c));
    halfEdgeSet.add(edgeKey(c, a));
    allHalfEdges.push([a, b], [b, c], [c, a]);
  }

  const boundaryEdges: [number, number][] = [];
  for (const [u, v] of allHalfEdges) {
    if (!halfEdgeSet.has(edgeKey(v, u))) {
      boundaryEdges.push([u, v]);
    }
  }

  // 9. Assemble final closed 3D triangle index buffer
  const totalTriangles = tris2D.length * 2 + boundaryEdges.length * 2;
  const indices = new Uint32Array(totalTriangles * 3);
  let ptr = 0;

  // Top surface (+Z normal, CCW)
  for (const [a, b, c] of tris2D) {
    indices[ptr++] = n2D + a;
    indices[ptr++] = n2D + b;
    indices[ptr++] = n2D + c;
  }

  // Bottom surface (-Z normal, reversed CW)
  for (const [a, b, c] of tris2D) {
    indices[ptr++] = a;
    indices[ptr++] = c;
    indices[ptr++] = b;
  }

  // Side walls along boundary edges (outward normal)
  for (const [u, v] of boundaryEdges) {
    const uBot = u;
    const vBot = v;
    const uTop = n2D + u;
    const vTop = n2D + v;
    indices[ptr++] = uBot;
    indices[ptr++] = vBot;
    indices[ptr++] = vTop;

    indices[ptr++] = uBot;
    indices[ptr++] = vTop;
    indices[ptr++] = uTop;
  }

  return {
    vertices,
    indices,
    vertexCount: n2D * 2,
    triangleCount: totalTriangles,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  };
}
