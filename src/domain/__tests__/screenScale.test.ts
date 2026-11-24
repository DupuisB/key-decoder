import { describe, expect, it } from 'vitest';
import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  cardPxToPxPerMm,
  clampPxPerMm,
  mmToScreenPx,
} from '../screenScale';

describe('1:1 Physical Screen Scale Calibration', () => {
  it('uses exact ISO/IEC 7810 ID-1 card dimensions', () => {
    expect(CARD_LONG_MM).toBeCloseTo(85.6, 2);
    expect(CARD_SHORT_MM).toBeCloseTo(53.98, 2);
  });

  it('converts calibrated card pixel length to exact px/mm and back', () => {
    const pxPerMm = cardPxToPxPerMm(513.6, 'long');
    expect(pxPerMm).toBeCloseTo(6.0, 3);
    expect(mmToScreenPx(CARD_LONG_MM, pxPerMm)).toBeCloseTo(513.6, 2);

    const shortScale = cardPxToPxPerMm(323.88, 'short');
    expect(shortScale).toBeCloseTo(6.0, 2);
  });

  it('clamps extreme out-of-range scale values safely', () => {
    expect(clampPxPerMm(0.1)).toBeGreaterThanOrEqual(2.4);
    expect(clampPxPerMm(99)).toBeLessThanOrEqual(9.5);
  });
});
