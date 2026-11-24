export type KeywayCategory = 'residential' | 'commercial' | 'padlock' | 'custom';

export interface WardingGroove {
  /** Which face the longitudinal groove is milled into ('top' = +Z, 'bottom' = -Z) */
  side: 'top' | 'bottom';
  /** Start height as a ratio of bladeWidthMm (0 = bottom spine, 1 = top of blank) */
  yStartRatio: number;
  /** End height as a ratio of bladeWidthMm */
  yEndRatio: number;
  /** Groove depth as a ratio of bladeThicknessMm (0..0.45) */
  depthRatio: number;
  /** Chamfer width along Y walls in mm for clean 45-degree printable geometry */
  chamferMm: number;
}

export interface BowGeometrySpec {
  /** Bow length extending along -X from shoulder (x = 0) in mm */
  lengthMm: number;
  /** Total bow height along Y in mm */
  widthMm: number;
  /** Keyring hole radius in mm */
  holeRadiusMm: number;
  /** Keyring hole center X offset (negative, from shoulder x = 0) in mm */
  holeCenterXMm: number;
  /** Shoulder stop height protruding above the blade top edge in mm */
  shoulderTopExtraMm: number;
  /** Shoulder stop drop protruding below the blade bottom spine in mm */
  shoulderBottomExtraMm: number;
}

export interface KeywaySpec {
  id: string;
  code: string;
  name: string;
  manufacturer: string;
  ilcoRef: string;
  dsdRef: string;
  category: KeywayCategory;
  description: string;
  pinCount: number;
  depthMin: number;
  depthMax: number;
  macs: number;
  /** Distance from shoulder stop to center of cut 1 (inches) */
  firstCutIn: number;
  /** Center-to-center pin spacing (inches) */
  pinSpacingIn: number;
  /** Exact center distances from shoulder stop for each pin (inches) */
  spacesIn: readonly number[];
  /** Depth step between consecutive bitting numbers (inches) */
  depthStepIn: number;
  /** Exact root heights measured from bottom spine for depthMin..depthMax (inches) */
  rootDepthsIn: readonly number[];
  /** Full uncut blank blade height (inches) */
  bladeWidthIn: number;
  /** Total blade length from shoulder stop to tip (inches) */
  bladeLengthIn: number;
  /** Nominal blade thickness (inches) */
  bladeThicknessIn: number;
  /** Flat bottom width of each cut (inches) */
  cutFlatIn: number;
  /** Included angle of the V-cut in degrees (e.g., 90 or 100) */
  cutAngleDeg: number;
  /** Length of the angled tip ramp along X (inches) */
  tipBevelLengthIn: number;
  /** Drop height of the tip bevel along Y (inches) */
  tipBevelHeightIn: number;
  /** Default realistic bitting cuts matching pinCount */
  defaultCuts: readonly number[];
  bow: BowGeometrySpec;
  warding: readonly WardingGroove[];
}

export interface Point2D {
  x: number;
  y: number;
}

export interface MacsViolation {
  pinIndexA: number;
  pinIndexB: number;
  delta: number;
  macs: number;
}

export interface PrintOptions {
  /** Scale factor for blade thickness (e.g. 0.98 = 98% for FDM clearance) */
  bladeThicknessScale: number;
  /** Adds extra thickness to the bow on +Z while keeping z=0 flat on build plate */
  reinforcedBow: boolean;
  /** Extra bow thickness in mm when reinforcedBow is enabled */
  bowExtraThicknessMm: number;
  /** Include longitudinal warding grooves */
  includeWarding: boolean;
}

export interface AnchorAlignment {
  /** Shoulder stop point (x=0, y=bladeWidth/2 or spine) in normalized image coordinates (0..1) */
  shoulder: Point2D;
  /** Blade tip point in normalized image coordinates (0..1) */
  tip: Point2D;
  /** Fine rotation offset in degrees */
  rotationOffsetDeg: number;
  /** Fine scale multiplier (1.0 = exact anchor distance) */
  scaleMultiplier: number;
  /** Optional vertical height scale (3rd anchor / perspective skew compensation) */
  heightScaleMultiplier: number;
  /** Optional skew factor along Y/X for perspective tilt compensation (-0.25..0.25) */
  skewY: number;
  /** Flip key bitting vertically (teeth on top vs teeth on bottom in photo) */
  flipVertical: boolean;
}

export interface CustomKeywayInput {
  name: string;
  unit: 'in' | 'mm';
  spaces: number[];
  rootDepths: number[];
  depthMin: number;
  bladeWidth: number;
  bladeLength: number;
  bladeThickness: number;
  cutFlat: number;
  cutAngleDeg: number;
  macs: number;
}
