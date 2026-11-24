import * as THREE from 'three';
import type { ManifoldMesh } from './keyMesh';

/**
 * Converts a ManifoldMesh into a non-indexed Three.js BufferGeometry with crisp flat face normals
 * so milled warding grooves, bitting ramps, and shoulder stops render with realistic metallic facets.
 */
export function manifoldMeshToThreeGeometry(mesh: ManifoldMesh): THREE.BufferGeometry {
  const triCount = mesh.triangleCount;
  const positions = new Float32Array(triCount * 9);
  const verts = mesh.vertices;
  const idx = mesh.indices;

  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = idx[t * 3 + k]! * 3;
      const dst = t * 9 + k * 3;
      positions[dst] = verts[vi]!;
      positions[dst + 1] = verts[vi + 1]!;
      positions[dst + 2] = verts[vi + 2]!;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
