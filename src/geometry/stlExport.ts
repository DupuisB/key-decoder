import type { BoundingBox3D, ManifoldMesh } from './keyMesh';

export interface StlTriangle {
  normal: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  v3: [number, number, number];
}

export interface StlAuditReport {
  headerText: string;
  triangleCount: number;
  byteLength: number;
  expectedByteLength: number;
  uniqueVertexCount: number;
  uniqueEdgeCount: number;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
  isWatertight: boolean;
  eulerCharacteristic: number;
  signedVolumeMm3: number;
  maxNormalAlignmentError: number;
  bounds: BoundingBox3D;
}

/**
 * Serializes a ManifoldMesh to an IEEE-754 little-endian Binary STL ArrayBuffer.
 * Format: 80-byte ASCII header + uint32 triangleCount + 50 bytes per triangle.
 */
export function exportMeshToBinaryStl(
  mesh: ManifoldMesh,
  headerLabel = 'Key Decoder Watertight STL (mm)',
): ArrayBuffer {
  const triCount = mesh.triangleCount;
  const byteLength = 84 + triCount * 50;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Write 80-byte ASCII header (must never start with 'solid ' to avoid confusing ASCII STL parsers)
  const safeHeader = headerLabel.startsWith('solid') ? `KD ${headerLabel}` : headerLabel;
  for (let i = 0; i < Math.min(80, safeHeader.length); i++) {
    bytes[i] = safeHeader.charCodeAt(i) & 0x7f;
  }

  // Write uint32 little-endian triangle count
  view.setUint32(80, triCount, true);

  const verts = mesh.vertices;
  const idx = mesh.indices;
  let offset = 84;

  for (let t = 0; t < triCount; t++) {
    const i0 = idx[t * 3]! * 3;
    const i1 = idx[t * 3 + 1]! * 3;
    const i2 = idx[t * 3 + 2]! * 3;

    const ax = verts[i0]!;
    const ay = verts[i0 + 1]!;
    const az = verts[i0 + 2]!;

    const bx = verts[i1]!;
    const by = verts[i1 + 1]!;
    const bz = verts[i1 + 2]!;

    const cx = verts[i2]!;
    const cy = verts[i2 + 1]!;
    const cz = verts[i2 + 2]!;

    // Compute unit outward face normal (B - A) x (C - A)
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) {
      nx /= len;
      ny /= len;
      nz /= len;
    } else {
      nx = 0;
      ny = 0;
      nz = 0;
    }

    // Normal
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    // Vertex 1
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);
    // Vertex 2
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);
    // Vertex 3
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);
    // Attribute byte count (0)
    view.setUint16(offset + 48, 0, true);

    offset += 50;
  }

  return buffer;
}

/**
 * Parses a binary STL ArrayBuffer and audits its watertightness, outward normals,
 * signed volume (divergence theorem), Euler characteristic, and exact bounding box.
 */
export function auditBinaryStl(buffer: ArrayBuffer): StlAuditReport {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let headerText = '';
  for (let i = 0; i < Math.min(80, bytes.length); i++) {
    const c = bytes[i]!;
    if (c === 0) break;
    headerText += String.fromCharCode(c);
  }

  const triangleCount = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const expectedByteLength = 84 + triangleCount * 50;

  const vertexMap = new Map<string, number>();
  const getVertexId = (x: number, y: number, z: number): number => {
    // Quantize to 1e-4 mm (0.1 micron) to match IEEE-754 float32 STL precision
    const key = `${Math.round(x * 10000)},${Math.round(y * 10000)},${Math.round(z * 10000)}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;
    const next = vertexMap.size;
    vertexMap.set(key, next);
    return next;
  };

  const directedEdgeCounts = new Map<string, number>();
  const undirectedEdges = new Set<string>();

  const recordEdge = (u: number, v: number) => {
    const dk = `${u}->${v}`;
    directedEdgeCounts.set(dk, (directedEdgeCounts.get(dk) ?? 0) + 1);
    const uk = u < v ? `${u}-${v}` : `${v}-${u}`;
    undirectedEdges.add(uk);
  };

  let signedVolume6 = 0;
  let maxNormalAlignmentError = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const updateBounds = (x: number, y: number, z: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };

  let offset = 84;
  for (let t = 0; t < triangleCount && offset + 50 <= buffer.byteLength; t++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);

    const ax = view.getFloat32(offset + 12, true);
    const ay = view.getFloat32(offset + 16, true);
    const az = view.getFloat32(offset + 20, true);

    const bx = view.getFloat32(offset + 24, true);
    const by = view.getFloat32(offset + 28, true);
    const bz = view.getFloat32(offset + 32, true);

    const cx = view.getFloat32(offset + 36, true);
    const cy = view.getFloat32(offset + 40, true);
    const cz = view.getFloat32(offset + 44, true);

    updateBounds(ax, ay, az);
    updateBounds(bx, by, bz);
    updateBounds(cx, cy, cz);

    const idA = getVertexId(ax, ay, az);
    const idB = getVertexId(bx, by, bz);
    const idC = getVertexId(cx, cy, cz);

    recordEdge(idA, idB);
    recordEdge(idB, idC);
    recordEdge(idC, idA);

    // Signed volume contribution: dot(A, cross(B, C)) / 6
    const bCx = by * cz - bz * cy;
    const bCy = bz * cx - bx * cz;
    const bCz = bx * cy - by * cx;
    signedVolume6 += ax * bCx + ay * bCy + az * bCz;

    // Compare stored normal against geometric normal
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    const gnx = aby * acz - abz * acy;
    const gny = abz * acx - abx * acz;
    const gnz = abx * acy - aby * acx;
    const glen = Math.hypot(gnx, gny, gnz);
    if (glen > 1e-8) {
      const dot = (nx * gnx + ny * gny + nz * gnz) / glen;
      const err = Math.abs(1 - dot);
      if (err > maxNormalAlignmentError) maxNormalAlignmentError = err;
    }

    offset += 50;
  }

  let openEdgeCount = 0;
  let nonManifoldEdgeCount = 0;

  for (const [dk, count] of directedEdgeCounts.entries()) {
    if (count > 1) {
      nonManifoldEdgeCount += count - 1;
    }
    const [uStr, vStr] = dk.split('->');
    const twinKey = `${vStr}->${uStr}`;
    const twinCount = directedEdgeCounts.get(twinKey) ?? 0;
    if (twinCount === 0) {
      openEdgeCount++;
    } else if (twinCount > 1) {
      nonManifoldEdgeCount++;
    }
  }

  const V = vertexMap.size;
  const E = undirectedEdges.size;
  const F = triangleCount;

  return {
    headerText: headerText.trim(),
    triangleCount,
    byteLength: buffer.byteLength,
    expectedByteLength,
    uniqueVertexCount: V,
    uniqueEdgeCount: E,
    openEdgeCount,
    nonManifoldEdgeCount,
    isWatertight:
      buffer.byteLength === expectedByteLength &&
      triangleCount > 0 &&
      openEdgeCount === 0 &&
      nonManifoldEdgeCount === 0,
    eulerCharacteristic: V - E + F,
    signedVolumeMm3: signedVolume6 / 6,
    maxNormalAlignmentError,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
  };
}

/**
 * Computes the maximum Y coordinate of the binary STL mesh at a given X slice (within +/- toleranceMm),
 * used to verify physical cut root heights in exported STL geometry.
 */
export function measureStlMaxYAtX(buffer: ArrayBuffer, targetX: number, toleranceMm = 0.05): number {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  let maxY = -Infinity;
  let offset = 84;

  for (let t = 0; t < triangleCount && offset + 50 <= buffer.byteLength; t++) {
    const verts: [number, number, number][] = [
      [view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true)],
      [view.getFloat32(offset + 24, true), view.getFloat32(offset + 28, true), view.getFloat32(offset + 32, true)],
      [view.getFloat32(offset + 36, true), view.getFloat32(offset + 40, true), view.getFloat32(offset + 44, true)],
    ];

    // Check vertices near targetX
    for (const [vx, vy] of verts) {
      if (Math.abs(vx - targetX) <= toleranceMm && vy > maxY) {
        maxY = vy;
      }
    }

    // Also intersect every triangle edge spanning targetX for exact height measurement
    for (let e = 0; e < 3; e++) {
      const [ax, ay] = verts[e]!;
      const [bx, by] = verts[(e + 1) % 3]!;
      if ((ax <= targetX && bx >= targetX) || (bx <= targetX && ax >= targetX)) {
        const span = bx - ax;
        if (Math.abs(span) > 1e-7) {
          const frac = (targetX - ax) / span;
          const iy = ay + frac * (by - ay);
          if (iy > maxY) maxY = iy;
        }
      }
    }

    offset += 50;
  }

  return maxY;
}
