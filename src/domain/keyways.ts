import type { BowGeometrySpec, KeywaySpec } from './types';

export const IN_TO_MM = 25.4;

export function inToMm(inches: number): number {
  return inches * IN_TO_MM;
}

export function mmToIn(mm: number): number {
  return mm / IN_TO_MM;
}

function buildLinearArray(start: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => Number((start + i * step).toFixed(4)));
}

const STANDARD_RESIDENTIAL_BOW: BowGeometrySpec = {
  lengthMm: 23.5,
  widthMm: 24.0,
  holeRadiusMm: 2.8,
  holeCenterXMm: -17.8,
  shoulderTopExtraMm: 3.4,
  shoulderBottomExtraMm: 2.8,
};

const COMMERCIAL_BOW: BowGeometrySpec = {
  lengthMm: 24.5,
  widthMm: 25.0,
  holeRadiusMm: 3.0,
  holeCenterXMm: -18.5,
  shoulderTopExtraMm: 3.6,
  shoulderBottomExtraMm: 3.0,
};

const PADLOCK_BOW: BowGeometrySpec = {
  lengthMm: 20.5,
  widthMm: 21.5,
  holeRadiusMm: 2.6,
  holeCenterXMm: -15.2,
  shoulderTopExtraMm: 2.8,
  shoulderBottomExtraMm: 2.4,
};

/**
 * Verified locksmith Depth & Space Data (DSD) keyway specifications.
 * Sources cross-checked against Hudson Lock / HPC Blitz code cards, LSA Michigan charts,
 * LockWiki, and Kaba Ilco Key Blank Directory.
 */
export const KEYWAY_PRESETS: readonly KeywaySpec[] = [
  // 1. Weiser WR5 (5-pin) — HPC C50 / DSD #65
  {
    id: 'WR5',
    code: 'WR5',
    name: 'Weiser WR5 (5-Pin)',
    manufacturer: 'Weiser',
    ilcoRef: '1054WB',
    dsdRef: 'HPC C50 / DSD #65',
    category: 'residential',
    description: 'Standard Weiser residential 5-pin keyway (0–9 depths, 0.018" steps).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 6,
    firstCutIn: 0.237,
    pinSpacingIn: 0.156,
    spacesIn: buildLinearArray(0.237, 0.156, 5), // [0.237, 0.393, 0.549, 0.705, 0.861]
    depthStepIn: 0.018,
    rootDepthsIn: buildLinearArray(0.315, -0.018, 10), // 0.315 down to 0.153
    bladeWidthIn: 0.335,
    bladeLengthIn: 1.075,
    bladeThicknessIn: 0.083,
    cutFlatIn: 0.045,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.125,
    tipBevelHeightIn: 0.145,
    defaultCuts: [1, 5, 2, 7, 6],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.20, yEndRatio: 0.44, depthRatio: 0.32, chamferMm: 0.35 },
      { side: 'top', yStartRatio: 0.62, yEndRatio: 0.80, depthRatio: 0.24, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.36, yEndRatio: 0.60, depthRatio: 0.28, chamferMm: 0.35 },
    ],
  },

  // 2. Weiser WR3 (5-pin classic blank) — HPC C50 / DSD #65
  {
    id: 'WR3',
    code: 'WR3',
    name: 'Weiser WR3 (5-Pin Classic)',
    manufacturer: 'Weiser',
    ilcoRef: '1054WB / WR3',
    dsdRef: 'HPC C50 / DSD #65',
    category: 'residential',
    description: 'Classic Weiser WR3 blank sharing WR5 large-pin DSD #65 spacing and 0–9 depths.',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 6,
    firstCutIn: 0.237,
    pinSpacingIn: 0.156,
    spacesIn: buildLinearArray(0.237, 0.156, 5),
    depthStepIn: 0.018,
    rootDepthsIn: buildLinearArray(0.315, -0.018, 10),
    bladeWidthIn: 0.330,
    bladeLengthIn: 1.060,
    bladeThicknessIn: 0.082,
    cutFlatIn: 0.045,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.140,
    defaultCuts: [2, 6, 3, 5, 1],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.22, yEndRatio: 0.46, depthRatio: 0.30, chamferMm: 0.35 },
      { side: 'bottom', yStartRatio: 0.38, yEndRatio: 0.62, depthRatio: 0.26, chamferMm: 0.35 },
    ],
  },

  // 3. Kwikset KW1 (5-pin) — HPC C18 / DSD #12
  {
    id: 'KW1',
    code: 'KW1',
    name: 'Kwikset KW1 (5-Pin)',
    manufacturer: 'Kwikset',
    ilcoRef: '1176',
    dsdRef: 'HPC C18 / DSD #12',
    category: 'residential',
    description: 'Most common North American residential 5-pin keyway (1–6 depths, 0.023" steps, wide 0.084" flat).',
    pinCount: 5,
    depthMin: 1,
    depthMax: 6,
    macs: 4,
    firstCutIn: 0.247,
    pinSpacingIn: 0.150,
    spacesIn: buildLinearArray(0.247, 0.150, 5), // [0.247, 0.397, 0.547, 0.697, 0.847]
    depthStepIn: 0.023,
    rootDepthsIn: buildLinearArray(0.329, -0.023, 6), // [0.329, 0.306, 0.283, 0.260, 0.237, 0.214]
    bladeWidthIn: 0.335,
    bladeLengthIn: 1.080,
    bladeThicknessIn: 0.081,
    cutFlatIn: 0.084,
    cutAngleDeg: 92,
    tipBevelLengthIn: 0.125,
    tipBevelHeightIn: 0.140,
    defaultCuts: [3, 1, 4, 2, 5],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.18, yEndRatio: 0.44, depthRatio: 0.32, chamferMm: 0.35 },
      { side: 'top', yStartRatio: 0.60, yEndRatio: 0.82, depthRatio: 0.26, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.32, yEndRatio: 0.58, depthRatio: 0.28, chamferMm: 0.35 },
    ],
  },

  // 4. Kwikset KW10 (6-pin) — HPC C18
  {
    id: 'KW10',
    code: 'KW10',
    name: 'Kwikset KW10 (6-Pin)',
    manufacturer: 'Kwikset',
    ilcoRef: '1176-6 / KW10',
    dsdRef: 'HPC C18 / DSD #12 (6-Pin)',
    category: 'residential',
    description: '6-pin extended Kwikset Titan/SmartKey blank with 0.150" spacing and 1–6 depths.',
    pinCount: 6,
    depthMin: 1,
    depthMax: 6,
    macs: 4,
    firstCutIn: 0.247,
    pinSpacingIn: 0.150,
    spacesIn: buildLinearArray(0.247, 0.150, 6), // [0.247, 0.397, 0.547, 0.697, 0.847, 0.997]
    depthStepIn: 0.023,
    rootDepthsIn: buildLinearArray(0.329, -0.023, 6),
    bladeWidthIn: 0.335,
    bladeLengthIn: 1.230,
    bladeThicknessIn: 0.081,
    cutFlatIn: 0.084,
    cutAngleDeg: 92,
    tipBevelLengthIn: 0.125,
    tipBevelHeightIn: 0.140,
    defaultCuts: [2, 5, 3, 1, 4, 2],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.18, yEndRatio: 0.44, depthRatio: 0.32, chamferMm: 0.35 },
      { side: 'top', yStartRatio: 0.60, yEndRatio: 0.82, depthRatio: 0.26, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.32, yEndRatio: 0.58, depthRatio: 0.28, chamferMm: 0.35 },
    ],
  },

  // 5. Schlage SC1 (5-pin) — HPC C45 / DSD #42
  {
    id: 'SC1',
    code: 'SC1',
    name: 'Schlage SC1 (5-Pin C Keyway)',
    manufacturer: 'Schlage',
    ilcoRef: '1145',
    dsdRef: 'HPC C45 / DSD #42',
    category: 'residential',
    description: 'Schlage C 5-pin residential/commercial standard (0–9 depths, 0.015" steps, 100° cuts).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 7,
    firstCutIn: 0.231,
    pinSpacingIn: 0.1562,
    spacesIn: buildLinearArray(0.231, 0.1562, 5), // [0.231, 0.3872, 0.5434, 0.6996, 0.8558]
    depthStepIn: 0.015,
    rootDepthsIn: buildLinearArray(0.335, -0.015, 10), // [0.335 .. 0.200]
    bladeWidthIn: 0.343,
    bladeLengthIn: 1.115,
    bladeThicknessIn: 0.081,
    cutFlatIn: 0.031,
    cutAngleDeg: 100,
    tipBevelLengthIn: 0.130,
    tipBevelHeightIn: 0.150,
    defaultCuts: [4, 1, 7, 2, 5],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.16, yEndRatio: 0.38, depthRatio: 0.34, chamferMm: 0.32 },
      { side: 'top', yStartRatio: 0.56, yEndRatio: 0.78, depthRatio: 0.28, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.30, yEndRatio: 0.55, depthRatio: 0.32, chamferMm: 0.32 },
    ],
  },

  // 6. Schlage SC4 (6-pin) — HPC C45
  {
    id: 'SC4',
    code: 'SC4',
    name: 'Schlage SC4 (6-Pin C Keyway)',
    manufacturer: 'Schlage',
    ilcoRef: '1145A',
    dsdRef: 'HPC C45 / DSD #42 (6-Pin)',
    category: 'commercial',
    description: 'Schlage C 6-pin commercial/residential blank (0–9 depths, 0.1562" spacing).',
    pinCount: 6,
    depthMin: 0,
    depthMax: 9,
    macs: 7,
    firstCutIn: 0.231,
    pinSpacingIn: 0.1562,
    spacesIn: buildLinearArray(0.231, 0.1562, 6), // [0.231, 0.3872, 0.5434, 0.6996, 0.8558, 1.012]
    depthStepIn: 0.015,
    rootDepthsIn: buildLinearArray(0.335, -0.015, 10),
    bladeWidthIn: 0.343,
    bladeLengthIn: 1.270,
    bladeThicknessIn: 0.081,
    cutFlatIn: 0.031,
    cutAngleDeg: 100,
    tipBevelLengthIn: 0.130,
    tipBevelHeightIn: 0.150,
    defaultCuts: [3, 6, 1, 8, 4, 2],
    bow: COMMERCIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.16, yEndRatio: 0.38, depthRatio: 0.34, chamferMm: 0.32 },
      { side: 'top', yStartRatio: 0.56, yEndRatio: 0.78, depthRatio: 0.28, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.30, yEndRatio: 0.55, depthRatio: 0.32, chamferMm: 0.32 },
    ],
  },

  // 7. Yale Y1 (5-pin) — HPC C57 / DSD #72
  {
    id: 'Y1',
    code: 'Y1',
    name: 'Yale Y1 (5-Pin Para)',
    manufacturer: 'Yale',
    ilcoRef: '999',
    dsdRef: 'HPC C57 / DSD #72',
    category: 'residential',
    description: 'Yale Y1 5-pin large-pin keyway (0–9 depths, 0.019" steps, 0.165" spacing).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 5,
    firstCutIn: 0.200,
    pinSpacingIn: 0.165,
    spacesIn: buildLinearArray(0.200, 0.165, 5), // [0.200, 0.365, 0.530, 0.695, 0.860]
    depthStepIn: 0.019,
    rootDepthsIn: buildLinearArray(0.320, -0.019, 10), // [0.320 .. 0.149]
    bladeWidthIn: 0.320,
    bladeLengthIn: 1.045,
    bladeThicknessIn: 0.080,
    cutFlatIn: 0.047,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.135,
    defaultCuts: [2, 5, 1, 6, 3],
    bow: STANDARD_RESIDENTIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.24, yEndRatio: 0.50, depthRatio: 0.34, chamferMm: 0.32 },
      { side: 'bottom', yStartRatio: 0.16, yEndRatio: 0.36, depthRatio: 0.26, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.54, yEndRatio: 0.74, depthRatio: 0.26, chamferMm: 0.30 },
    ],
  },

  // 8. Yale Y2 (6-pin) — HPC C57
  {
    id: 'Y2',
    code: 'Y2',
    name: 'Yale Y2 (6-Pin Para)',
    manufacturer: 'Yale',
    ilcoRef: '999A',
    dsdRef: 'HPC C57 / DSD #72 (6-Pin)',
    category: 'commercial',
    description: 'Yale Y2 6-pin commercial/residential blank (0–9 depths, 0.019" steps, 0.165" spacing).',
    pinCount: 6,
    depthMin: 0,
    depthMax: 9,
    macs: 5,
    firstCutIn: 0.200,
    pinSpacingIn: 0.165,
    spacesIn: buildLinearArray(0.200, 0.165, 6), // [0.200, 0.365, 0.530, 0.695, 0.860, 1.025]
    depthStepIn: 0.019,
    rootDepthsIn: buildLinearArray(0.320, -0.019, 10),
    bladeWidthIn: 0.320,
    bladeLengthIn: 1.210,
    bladeThicknessIn: 0.080,
    cutFlatIn: 0.047,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.135,
    defaultCuts: [3, 6, 2, 5, 1, 4],
    bow: COMMERCIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.24, yEndRatio: 0.50, depthRatio: 0.34, chamferMm: 0.32 },
      { side: 'bottom', yStartRatio: 0.16, yEndRatio: 0.36, depthRatio: 0.26, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.54, yEndRatio: 0.74, depthRatio: 0.26, chamferMm: 0.30 },
    ],
  },

  // 9. Master Lock M1 (4-pin) — 1K Padlock Keyway
  {
    id: 'M1',
    code: 'M1',
    name: 'Master Lock M1 (4-Pin Padlock)',
    manufacturer: 'Master Lock',
    ilcoRef: '1092',
    dsdRef: 'Master 1K / HPC C23',
    category: 'padlock',
    description: 'Classic Master Lock No. 1/3/5 laminated padlock 4-pin keyway (0–7 depths, 0.0155" steps).',
    pinCount: 4,
    depthMin: 0,
    depthMax: 7,
    macs: 5,
    firstCutIn: 0.187,
    pinSpacingIn: 0.125,
    spacesIn: buildLinearArray(0.187, 0.125, 4), // [0.187, 0.312, 0.437, 0.562]
    depthStepIn: 0.0155,
    rootDepthsIn: buildLinearArray(0.272, -0.0155, 8), // [0.272 .. 0.1635]
    bladeWidthIn: 0.281,
    bladeLengthIn: 0.780,
    bladeThicknessIn: 0.080,
    cutFlatIn: 0.040,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.105,
    tipBevelHeightIn: 0.120,
    defaultCuts: [2, 5, 1, 4],
    bow: PADLOCK_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.22, yEndRatio: 0.52, depthRatio: 0.30, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.34, yEndRatio: 0.62, depthRatio: 0.26, chamferMm: 0.30 },
    ],
  },

  // 10. Master Lock M10 (5-pin) — 15K / ProSeries Padlock Keyway
  {
    id: 'M10',
    code: 'M10',
    name: 'Master Lock M10 (5-Pin Padlock)',
    manufacturer: 'Master Lock',
    ilcoRef: '1092N',
    dsdRef: 'Master 15K / M10',
    category: 'padlock',
    description: 'Extended 5-pin Master Lock padlock blank (0–7 depths, 0.125" spacing, 0.0155" steps).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 7,
    macs: 5,
    firstCutIn: 0.187,
    pinSpacingIn: 0.125,
    spacesIn: buildLinearArray(0.187, 0.125, 5), // [0.187, 0.312, 0.437, 0.562, 0.687]
    depthStepIn: 0.0155,
    rootDepthsIn: buildLinearArray(0.272, -0.0155, 8),
    bladeWidthIn: 0.281,
    bladeLengthIn: 0.905,
    bladeThicknessIn: 0.080,
    cutFlatIn: 0.040,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.105,
    tipBevelHeightIn: 0.120,
    defaultCuts: [1, 4, 2, 6, 3],
    bow: PADLOCK_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.22, yEndRatio: 0.52, depthRatio: 0.30, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.34, yEndRatio: 0.62, depthRatio: 0.26, chamferMm: 0.30 },
    ],
  },

  // 11. Sargent LA (5-pin) — Commercial Sectional Keyway
  {
    id: 'LA5',
    code: 'LA-5',
    name: 'Sargent LA (5-Pin)',
    manufacturer: 'Sargent',
    ilcoRef: '1007LA-5',
    dsdRef: 'Sargent LA / HPC C36',
    category: 'commercial',
    description: 'Sargent LA 5-pin commercial keyway (0–9 depths, 0.020" steps, 0.156" spacing).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 7,
    firstCutIn: 0.216,
    pinSpacingIn: 0.156,
    spacesIn: buildLinearArray(0.216, 0.156, 5), // [0.216, 0.372, 0.528, 0.684, 0.840]
    depthStepIn: 0.020,
    rootDepthsIn: buildLinearArray(0.330, -0.020, 10), // [0.330 .. 0.150]
    bladeWidthIn: 0.335,
    bladeLengthIn: 1.070,
    bladeThicknessIn: 0.085,
    cutFlatIn: 0.042,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.140,
    defaultCuts: [2, 6, 3, 7, 1],
    bow: COMMERCIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.18, yEndRatio: 0.42, depthRatio: 0.32, chamferMm: 0.32 },
      { side: 'top', yStartRatio: 0.58, yEndRatio: 0.78, depthRatio: 0.25, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.32, yEndRatio: 0.58, depthRatio: 0.30, chamferMm: 0.32 },
    ],
  },

  // 12. Sargent LA (6-pin) — Commercial Sectional Keyway
  {
    id: 'LA6',
    code: 'LA-6',
    name: 'Sargent LA (6-Pin)',
    manufacturer: 'Sargent',
    ilcoRef: '1007LA / S22',
    dsdRef: 'Sargent LA / HPC C36 (6-Pin)',
    category: 'commercial',
    description: 'Sargent LA 6-pin commercial mortise/rim standard (0–9 depths, 0.020" steps, 0.156" spacing).',
    pinCount: 6,
    depthMin: 0,
    depthMax: 9,
    macs: 7,
    firstCutIn: 0.216,
    pinSpacingIn: 0.156,
    spacesIn: buildLinearArray(0.216, 0.156, 6), // [0.216, 0.372, 0.528, 0.684, 0.840, 0.996]
    depthStepIn: 0.020,
    rootDepthsIn: buildLinearArray(0.330, -0.020, 10),
    bladeWidthIn: 0.335,
    bladeLengthIn: 1.225,
    bladeThicknessIn: 0.085,
    cutFlatIn: 0.042,
    cutAngleDeg: 90,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.140,
    defaultCuts: [1, 5, 3, 7, 2, 6],
    bow: COMMERCIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.18, yEndRatio: 0.42, depthRatio: 0.32, chamferMm: 0.32 },
      { side: 'top', yStartRatio: 0.58, yEndRatio: 0.78, depthRatio: 0.25, chamferMm: 0.30 },
      { side: 'bottom', yStartRatio: 0.32, yEndRatio: 0.58, depthRatio: 0.30, chamferMm: 0.32 },
    ],
  },

  // 13. Arrow AR1 (5-pin) — Ilco 1179
  {
    id: 'AR1',
    code: 'AR1',
    name: 'Arrow AR1 (5-Pin)',
    manufacturer: 'Arrow',
    ilcoRef: '1179',
    dsdRef: 'Arrow 0.015" / HPC C3',
    category: 'commercial',
    description: 'Arrow AR1 5-pin commercial/residential keyway (0–9 depths, 0.015" steps, 0.155" spacing).',
    pinCount: 5,
    depthMin: 0,
    depthMax: 9,
    macs: 6,
    firstCutIn: 0.265,
    pinSpacingIn: 0.155,
    spacesIn: buildLinearArray(0.265, 0.155, 5), // [0.265, 0.420, 0.575, 0.730, 0.885]
    depthStepIn: 0.015,
    rootDepthsIn: buildLinearArray(0.325, -0.015, 10), // [0.325 .. 0.190]
    bladeWidthIn: 0.330,
    bladeLengthIn: 1.090,
    bladeThicknessIn: 0.081,
    cutFlatIn: 0.045,
    cutAngleDeg: 96,
    tipBevelLengthIn: 0.120,
    tipBevelHeightIn: 0.140,
    defaultCuts: [3, 1, 6, 2, 5],
    bow: COMMERCIAL_BOW,
    warding: [
      { side: 'top', yStartRatio: 0.20, yEndRatio: 0.46, depthRatio: 0.30, chamferMm: 0.32 },
      { side: 'bottom', yStartRatio: 0.38, yEndRatio: 0.64, depthRatio: 0.28, chamferMm: 0.32 },
    ],
  },
];

export function getKeywayById(id: string): KeywaySpec | undefined {
  return KEYWAY_PRESETS.find((k) => k.id.toLowerCase() === id.toLowerCase());
}

export const DEFAULT_KEYWAY_ID = 'WR5';
