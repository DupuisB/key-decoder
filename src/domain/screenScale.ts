/** ISO/IEC 7810 ID-1 standard card dimensions (bank, credit/debit, national ID, driver's license) */
export const CARD_LONG_MM = 85.6;
export const CARD_SHORT_MM = 53.98;

export const MIN_PX_PER_MM = 2.4;
export const MAX_PX_PER_MM = 9.5;

const STORAGE_KEY = 'key-decoder-screen-scale-v1';

export type CardEdgeMode = 'long' | 'short';

export interface SavedScreenScale {
  pxPerMm: number;
  locked: boolean;
  cardEdge: CardEdgeMode;
}

export function clampPxPerMm(value: number): number {
  if (!Number.isFinite(value)) return 4.5;
  return Number(Math.max(MIN_PX_PER_MM, Math.min(MAX_PX_PER_MM, value)).toFixed(3));
}

export function mmToScreenPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

export function cardPxToPxPerMm(cardPx: number, edge: CardEdgeMode): number {
  const refMm = edge === 'long' ? CARD_LONG_MM : CARD_SHORT_MM;
  return clampPxPerMm(cardPx / refMm);
}

export function getDefaultPxPerMm(): number {
  if (typeof window === 'undefined') return 3.78;
  // Smartphones typically render ~5.6-6.2 CSS px/mm; desktop monitors ~3.78-4.5 CSS px/mm
  return window.innerWidth < 768 ? 5.8 : 3.78;
}

export function loadScreenScale(): SavedScreenScale {
  const fallback: SavedScreenScale = {
    pxPerMm: getDefaultPxPerMm(),
    locked: false,
    cardEdge: 'long',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedScreenScale>;
    if (typeof parsed.pxPerMm !== 'number' || !Number.isFinite(parsed.pxPerMm)) {
      return fallback;
    }
    return {
      pxPerMm: clampPxPerMm(parsed.pxPerMm),
      locked: Boolean(parsed.locked),
      cardEdge: parsed.cardEdge === 'short' ? 'short' : 'long',
    };
  } catch {
    return fallback;
  }
}

export function saveScreenScale(state: SavedScreenScale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors in private/restricted browsers
  }
}
