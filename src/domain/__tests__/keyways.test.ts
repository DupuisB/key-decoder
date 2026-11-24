import { describe, expect, it } from 'vitest';
import {
  buildCustomKeywaySpec,
  checkMacsViolations,
  computeBittingProfile,
  getAllSpacesMm,
  getRootDepthMm,
  sampleProfileHeight,
} from '../bitting';
import { getKeywayById, inToMm, KEYWAY_PRESETS } from '../keyways';
import { decodeStateFromHash, encodeStateToHash } from '../urlState';

describe('Locksmith DSD Keyway Specifications', () => {
  it('matches published Weiser WR5 DSD #65 / HPC C50 spacing and root depths', () => {
    const wr5 = getKeywayById('WR5')!;
    expect(wr5).toBeDefined();
    expect(wr5.pinCount).toBe(5);
    expect(wr5.depthMin).toBe(0);
    expect(wr5.depthMax).toBe(9);
    expect(wr5.spacesIn).toEqual([0.237, 0.393, 0.549, 0.705, 0.861]);
    expect(wr5.rootDepthsIn).toEqual([0.315, 0.297, 0.279, 0.261, 0.243, 0.225, 0.207, 0.189, 0.171, 0.153]);

    // Verify exact mm conversions (25.4 mm/in)
    expect(getAllSpacesMm(wr5)[0]).toBeCloseTo(0.237 * 25.4, 4);
    expect(getRootDepthMm(wr5, 0)).toBeCloseTo(0.315 * 25.4, 4);
    expect(getRootDepthMm(wr5, 9)).toBeCloseTo(0.153 * 25.4, 4);
  });

  it('matches published Kwikset KW1 & KW10 DSD #12 / HPC C18 specs', () => {
    const kw1 = getKeywayById('KW1')!;
    const kw10 = getKeywayById('KW10')!;
    expect(kw1.pinCount).toBe(5);
    expect(kw10.pinCount).toBe(6);
    expect(kw1.depthMin).toBe(1);
    expect(kw1.depthMax).toBe(6);
    expect(kw1.spacesIn).toEqual([0.247, 0.397, 0.547, 0.697, 0.847]);
    expect(kw10.spacesIn).toEqual([0.247, 0.397, 0.547, 0.697, 0.847, 0.997]);
    expect(kw1.rootDepthsIn).toEqual([0.329, 0.306, 0.283, 0.260, 0.237, 0.214]);
    expect(getRootDepthMm(kw1, 1)).toBeCloseTo(inToMm(0.329), 4);
    expect(getRootDepthMm(kw1, 6)).toBeCloseTo(inToMm(0.214), 4);
  });

  it('matches published Schlage SC1 & SC4 DSD #42 / HPC C45 specs', () => {
    const sc1 = getKeywayById('SC1')!;
    const sc4 = getKeywayById('SC4')!;
    expect(sc1.spacesIn).toEqual([0.231, 0.3872, 0.5434, 0.6996, 0.8558]);
    expect(sc4.spacesIn).toEqual([0.231, 0.3872, 0.5434, 0.6996, 0.8558, 1.012]);
    expect(sc1.rootDepthsIn).toEqual([0.335, 0.320, 0.305, 0.290, 0.275, 0.260, 0.245, 0.230, 0.215, 0.200]);
  });

  it('matches published Yale Y1 & Y2 DSD #72 / HPC C57 specs', () => {
    const y1 = getKeywayById('Y1')!;
    const y2 = getKeywayById('Y2')!;
    expect(y1.spacesIn).toEqual([0.200, 0.365, 0.530, 0.695, 0.860]);
    expect(y2.spacesIn).toEqual([0.200, 0.365, 0.530, 0.695, 0.860, 1.025]);
    expect(y1.rootDepthsIn[0]).toBeCloseTo(0.320, 4);
    expect(y1.rootDepthsIn[9]).toBeCloseTo(0.149, 4);
  });

  it('matches published Master Lock M1 & M10, Sargent LA, and Arrow AR1 specs', () => {
    const m1 = getKeywayById('M1')!;
    const m10 = getKeywayById('M10')!;
    const la6 = getKeywayById('LA6')!;
    const ar1 = getKeywayById('AR1')!;

    expect(m1.spacesIn).toEqual([0.187, 0.312, 0.437, 0.562]);
    expect(m10.spacesIn).toEqual([0.187, 0.312, 0.437, 0.562, 0.687]);
    expect(m1.rootDepthsIn[0]).toBeCloseTo(0.272, 4);
    expect(m1.rootDepthsIn[7]).toBeCloseTo(0.1635, 4);

    expect(la6.spacesIn).toEqual([0.216, 0.372, 0.528, 0.684, 0.840, 0.996]);
    expect(la6.rootDepthsIn[0]).toBeCloseTo(0.330, 4);
    expect(la6.rootDepthsIn[9]).toBeCloseTo(0.150, 4);

    expect(ar1.spacesIn).toEqual([0.265, 0.420, 0.575, 0.730, 0.885]);
    expect(ar1.rootDepthsIn[0]).toBeCloseTo(0.325, 4);
    expect(ar1.rootDepthsIn[9]).toBeCloseTo(0.190, 4);
  });

  it('has valid internal consistency and zero MACS violations on default cuts for every preset', () => {
    for (const spec of KEYWAY_PRESETS) {
      expect(spec.spacesIn.length).toBe(spec.pinCount);
      expect(spec.rootDepthsIn.length).toBe(spec.depthMax - spec.depthMin + 1);
      expect(spec.defaultCuts.length).toBe(spec.pinCount);
      expect(checkMacsViolations(spec, spec.defaultCuts)).toEqual([]);

      // Verify bitting profile hits exact root height at every pin center within +/- 0.005 mm
      const profile = computeBittingProfile(spec, spec.defaultCuts);
      const spacesMm = getAllSpacesMm(spec);
      for (let i = 0; i < spec.pinCount; i++) {
        const measured = sampleProfileHeight(profile, spacesMm[i]!);
        const expected = getRootDepthMm(spec, spec.defaultCuts[i]!);
        expect(Math.abs(measured - expected)).toBeLessThan(0.005);
      }
    }
  });

  it('detects MACS violations accurately', () => {
    const kw1 = getKeywayById('KW1')!; // MACS = 4
    expect(checkMacsViolations(kw1, [1, 5, 1, 5, 1])).toEqual([]);
    const violations = checkMacsViolations(kw1, [1, 6, 3, 2, 1]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ pinIndexA: 0, pinIndexB: 1, delta: 5, macs: 4 });
  });

  it('supports Custom Keyway Mode in both millimeters and inches', () => {
    const customMm = buildCustomKeywaySpec({
      name: 'Euro Test 5',
      unit: 'mm',
      spaces: [5.0, 9.0, 13.0, 17.0, 21.0],
      rootDepths: [8.0, 7.5, 7.0, 6.5, 6.0, 5.5],
      depthMin: 0,
      bladeWidth: 8.4,
      bladeLength: 26.0,
      bladeThickness: 2.1,
      cutFlat: 1.0,
      cutAngleDeg: 90,
      macs: 4,
    });
    expect(customMm.pinCount).toBe(5);
    expect(getAllSpacesMm(customMm)[0]).toBeCloseTo(5.0, 3);
    expect(getRootDepthMm(customMm, 0)).toBeCloseTo(8.0, 3);
    expect(getRootDepthMm(customMm, 5)).toBeCloseTo(5.5, 3);
    expect(inToMm(customMm.bladeLengthIn)).toBeCloseTo(26.0, 3);
  });

  it('round-trips URL hash state cleanly', () => {
    const hash = encodeStateToHash('WR5', [1, 5, 2, 7, 6]);
    expect(hash).toBe('#keyway=WR5&cuts=1-5-2-7-6');
    const decoded = decodeStateFromHash(hash);
    expect(decoded).toEqual({ keywayId: 'WR5', cuts: [1, 5, 2, 7, 6] });
  });
});
