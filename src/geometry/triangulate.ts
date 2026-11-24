import type { Point2D } from '../domain/types';

export interface IndexedPoint2D extends Point2D {
  index: number;
}

const EPS = 1e-9;

function cross2D(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function polygonSignedArea(pts: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const c1 = cross2D(a, b, p);
  const c2 = cross2D(b, c, p);
  const c3 = cross2D(c, a, p);
  return c1 >= -EPS && c2 >= -EPS && c3 >= -EPS;
}

/**
 * Bridges a single CW hole into a CCW outer simple polygon (Eberly's algorithm),
 * returning a merged vertex index loop suitable for ear-clipping triangulation.
 */
function bridgeHoleIntoOuter(
  outer: readonly IndexedPoint2D[],
  hole: readonly IndexedPoint2D[],
): IndexedPoint2D[] {
  // 1. Find rightmost vertex M of the hole (maximum X)
  let holeRightIdx = 0;
  for (let i = 1; i < hole.length; i++) {
    if (hole[i]!.x > hole[holeRightIdx]!.x) {
      holeRightIdx = i;
    }
  }
  const M = hole[holeRightIdx]!;

  // 2. Cast horizontal ray +X from M to find closest intersection I on outer edges
  let bestX = Infinity;
  let bestEdgeIdx = -1;

  for (let i = 0; i < outer.length; i++) {
    const a = outer[i]!;
    const b = outer[(i + 1) % outer.length]!;
    // Edge must span M.y (going upward for a CCW outer polygon on the right side)
    if ((a.y <= M.y && b.y > M.y) || (b.y <= M.y && a.y > M.y)) {
      const dy = b.y - a.y;
      if (Math.abs(dy) < EPS) continue;
      const t = (M.y - a.y) / dy;
      const ix = a.x + t * (b.x - a.x);
      if (ix >= M.x - EPS && ix < bestX) {
        bestX = ix;
        bestEdgeIdx = i;
      }
    }
  }

  // Pick visible outer vertex P
  let outerBridgeIdx = 0;
  if (bestEdgeIdx >= 0) {
    const a = outer[bestEdgeIdx]!;
    const b = outer[(bestEdgeIdx + 1) % outer.length]!;
    const I: Point2D = { x: bestX, y: M.y };

    // Choose endpoint of intersected edge with larger X (or closer to I)
    let candidateIdx = a.x >= b.x ? bestEdgeIdx : (bestEdgeIdx + 1) % outer.length;
    const P = outer[candidateIdx]!;

    // Check if any reflex outer vertex lies strictly inside triangle (M, I, P)
    // Ensure triangle orientation is CCW for pointInTriangle test
    const triCCW = cross2D(M, I, P) >= 0;
    let bestAngle = Infinity;
    let bestDistSq = Infinity;

    for (let i = 0; i < outer.length; i++) {
      const v = outer[i]!;
      if (v.index === P.index) continue;
      const inside = triCCW ? pointInTriangle(v, M, I, P) : pointInTriangle(v, M, P, I);
      if (inside) {
        const dx = v.x - M.x;
        const dy = v.y - M.y;
        const angle = Math.abs(Math.atan2(dy, dx));
        const distSq = dx * dx + dy * dy;
        if (angle < bestAngle - 1e-9 || (Math.abs(angle - bestAngle) <= 1e-9 && distSq < bestDistSq)) {
          bestAngle = angle;
          bestDistSq = distSq;
          candidateIdx = i;
        }
      }
    }
    outerBridgeIdx = candidateIdx;
  } else {
    // Fallback: closest outer vertex to M
    let minD = Infinity;
    for (let i = 0; i < outer.length; i++) {
      const v = outer[i]!;
      const d = (v.x - M.x) ** 2 + (v.y - M.y) ** 2;
      if (d < minD) {
        minD = d;
        outerBridgeIdx = i;
      }
    }
  }

  // 3. Splice: outer[0..outerBridgeIdx] -> hole[holeRightIdx..wrap..holeRightIdx] -> outer[outerBridgeIdx..end]
  const merged: IndexedPoint2D[] = [];
  for (let i = 0; i <= outerBridgeIdx; i++) {
    merged.push(outer[i]!);
  }
  for (let k = 0; k <= hole.length; k++) {
    merged.push(hole[(holeRightIdx + k) % hole.length]!);
  }
  for (let i = outerBridgeIdx; i < outer.length; i++) {
    merged.push(outer[i]!);
  }
  return merged;
}

/**
 * Triangulates a CCW planar polygon with an optional CW hole via hole-bridging + ear-clipping.
 * Returns array of [idxA, idxB, idxC] triples referencing original IndexedPoint2D.index values,
 * all oriented strictly counter-clockwise.
 */
export function triangulatePolygonWithHole(
  outerCCW: readonly IndexedPoint2D[],
  holeCW?: readonly IndexedPoint2D[],
): [number, number, number][] {
  const poly = holeCW && holeCW.length >= 3 ? bridgeHoleIntoOuter(outerCCW, holeCW) : [...outerCCW];
  const triangles: [number, number, number][] = [];

  // Working copy of polygon vertices
  const verts = [...poly];
  let guard = verts.length * verts.length + 100;

  while (verts.length > 3 && guard-- > 0) {
    let earFound = false;
    const n = verts.length;

    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n]!;
      const curr = verts[i]!;
      const next = verts[(i + 1) % n]!;

      const area2 = cross2D(prev, curr, next);
      if (area2 <= EPS) continue; // reflex or collinear

      // Check no other vertex falls inside triangle (prev, curr, next)
      let hasInside = false;
      for (let j = 0; j < n; j++) {
        if (j === i || j === (i - 1 + n) % n || j === (i + 1) % n) continue;
        const p = verts[j]!;
        // Ignore vertices coincident with triangle corners (from hole bridge)
        if (p.index === prev.index || p.index === curr.index || p.index === next.index) continue;
        if (pointInTriangle(p, prev, curr, next)) {
          hasInside = true;
          break;
        }
      }

      if (!hasInside) {
        if (prev.index !== curr.index && curr.index !== next.index && next.index !== prev.index) {
          triangles.push([prev.index, curr.index, next.index]);
        }
        verts.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      // Remove any zero-area / collinear corner to unblock ear-clipping
      let removedCollinear = false;
      for (let i = 0; i < n; i++) {
        const prev = verts[(i - 1 + n) % n]!;
        const curr = verts[i]!;
        const next = verts[(i + 1) % n]!;
        if (Math.abs(cross2D(prev, curr, next)) <= 1e-6) {
          verts.splice(i, 1);
          removedCollinear = true;
          break;
        }
      }
      if (!removedCollinear) {
        // Fallback: clip smallest positive-area convex vertex
        let bestIdx = -1;
        let bestArea = Infinity;
        for (let i = 0; i < n; i++) {
          const prev = verts[(i - 1 + n) % n]!;
          const curr = verts[i]!;
          const next = verts[(i + 1) % n]!;
          const area2 = cross2D(prev, curr, next);
          if (area2 > EPS && area2 < bestArea) {
            bestArea = area2;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          const prev = verts[(bestIdx - 1 + n) % n]!;
          const curr = verts[bestIdx]!;
          const next = verts[(bestIdx + 1) % n]!;
          if (prev.index !== curr.index && curr.index !== next.index && next.index !== prev.index) {
            triangles.push([prev.index, curr.index, next.index]);
          }
          verts.splice(bestIdx, 1);
        } else {
          break;
        }
      }
    }
  }

  if (verts.length === 3) {
    const a = verts[0]!;
    const b = verts[1]!;
    const c = verts[2]!;
    if (a.index !== b.index && b.index !== c.index && c.index !== a.index) {
      const area2 = cross2D(a, b, c);
      if (area2 > EPS) {
        triangles.push([a.index, b.index, c.index]);
      } else if (area2 < -EPS) {
        triangles.push([a.index, c.index, b.index]);
      }
    }
  }

  return triangles;
}
