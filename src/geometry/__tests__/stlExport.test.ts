import { describe, expect, it } from 'vitest';
import { getAllSpacesMm, getRootDepthMm } from '../../domain/bitting';
import { getKeywayById, inToMm, KEYWAY_PRESETS } from '../../domain/keyways';
import { buildKeyMesh } from '../keyMesh';
import { auditBinaryStl, exportMeshToBinaryStl, measureStlMaxYAtX } from '../stlExport';

describe('Procedural Watertight 3D Manifold & Binary STL Exporter', () => {
  it('generates a watertight, genus-1 manifold binary STL with exact dimensions for every preset', () => {
    for (const spec of KEYWAY_PRESETS) {
      const mesh = buildKeyMesh(spec, spec.defaultCuts, {
        bladeThicknessScale: 1.0,
        reinforcedBow: false,
        includeWarding: true,
      });
      const stlBuffer = exportMeshToBinaryStl(mesh, `KeyDecoder ${spec.code}`);
      const audit = auditBinaryStl(stlBuffer);

      expect(audit.byteLength, `${spec.id} byte length`).toBe(audit.expectedByteLength);
      expect(audit.triangleCount, `${spec.id} triangle count`).toBeGreaterThan(200);
      expect(audit.openEdgeCount, `${spec.id} open edges`).toBe(0);
      expect(audit.nonManifoldEdgeCount, `${spec.id} non-manifold edges`).toBe(0);
      expect(audit.isWatertight, `${spec.id} watertight`).toBe(true);
      // Genus-1 closed surface (key with keyring hole) has Euler characteristic V - E + F = 0
      expect(audit.eulerCharacteristic, `${spec.id} Euler characteristic`).toBe(0);
      // Strictly positive signed volume proves consistent outward-pointing normals
      expect(audit.signedVolumeMm3, `${spec.id} signed volume`).toBeGreaterThan(400);
      expect(audit.maxNormalAlignmentError, `${spec.id} normal alignment`).toBeLessThan(1e-4);

      // Exact physical dimensions within +/- 0.01 mm
      const expectedBladeLengthMm = inToMm(spec.bladeLengthIn);
      expect(Math.abs(audit.bounds.maxX - expectedBladeLengthMm), `${spec.id} blade length`).toBeLessThan(0.01);
      expect(Math.abs(audit.bounds.minZ), `${spec.id} flat on build plate z=0`).toBeLessThan(0.001);
      const expectedThicknessMm = inToMm(spec.bladeThicknessIn);
      expect(Math.abs(audit.bounds.maxZ - expectedThicknessMm), `${spec.id} blade thickness`).toBeLessThan(0.01);

      // Verify exact root height at every single pin center in the exported binary STL!
      const spacesMm = getAllSpacesMm(spec);
      for (let i = 0; i < spec.pinCount; i++) {
        const measuredY = measureStlMaxYAtX(stlBuffer, spacesMm[i]!, 0.02);
        const expectedY = getRootDepthMm(spec, spec.defaultCuts[i]!);
        expect(
          Math.abs(measuredY - expectedY),
          `${spec.id} pin ${i + 1} root height (measured=${measuredY.toFixed(4)}, expected=${expectedY.toFixed(4)})`,
        ).toBeLessThan(0.01);
      }
    }
  });

  it('respects blade thickness scaling and reinforced bow options while staying watertight', () => {
    const wr5 = getKeywayById('WR5')!;
    const mesh = buildKeyMesh(wr5, [1, 5, 2, 7, 6], {
      bladeThicknessScale: 0.95,
      reinforcedBow: true,
      bowExtraThicknessMm: 0.9,
      includeWarding: true,
    });
    const stl = exportMeshToBinaryStl(mesh, 'WR5 Reinforced');
    const audit = auditBinaryStl(stl);

    expect(audit.isWatertight).toBe(true);
    expect(audit.eulerCharacteristic).toBe(0);
    expect(audit.signedVolumeMm3).toBeGreaterThan(500);
    expect(audit.bounds.minZ).toBeCloseTo(0, 4);

    const expectedMaxZ = inToMm(wr5.bladeThicknessIn) * 0.95 + 0.9;
    expect(Math.abs(audit.bounds.maxZ - expectedMaxZ)).toBeLessThan(0.01);
  });

  it('remains watertight under extreme MACS-violating deep/shallow bitting combinations', () => {
    const sc1 = getKeywayById('SC1')!;
    const extremeBittings = [
      [0, 9, 0, 9, 0],
      [9, 9, 9, 9, 9],
      [0, 0, 0, 0, 0],
      [9, 0, 9, 0, 9],
    ];

    for (const cuts of extremeBittings) {
      const mesh = buildKeyMesh(sc1, cuts);
      const stl = exportMeshToBinaryStl(mesh, 'SC1 Extreme');
      const audit = auditBinaryStl(stl);

      expect(audit.isWatertight).toBe(true);
      expect(audit.openEdgeCount).toBe(0);
      expect(audit.nonManifoldEdgeCount).toBe(0);
      expect(audit.eulerCharacteristic).toBe(0);
      expect(audit.signedVolumeMm3).toBeGreaterThan(300);
    }
  });
});
