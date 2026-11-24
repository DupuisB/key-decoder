import { clampCutsToSpec, formatBittingCode } from './bitting';
import { getKeywayById } from './keyways';

export interface UrlHashState {
  keywayId: string;
  cuts: number[];
}

export function encodeStateToHash(keywayId: string, cuts: readonly number[]): string {
  const params = new URLSearchParams();
  params.set('keyway', keywayId);
  params.set('cuts', formatBittingCode(cuts, '-'));
  return `#${params.toString()}`;
}

export function decodeStateFromHash(hash: string): UrlHashState | null {
  const cleaned = hash.replace(/^#/, '').trim();
  if (!cleaned) return null;

  const params = new URLSearchParams(cleaned);
  const keywayId = params.get('keyway');
  const cutsRaw = params.get('cuts');
  if (!keywayId) return null;

  const spec = getKeywayById(keywayId);
  if (!spec) return null;

  if (!cutsRaw) {
    return { keywayId: spec.id, cuts: [...spec.defaultCuts] };
  }

  const parsed = cutsRaw
    .split(/[-,\s]+/)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));

  if (parsed.length === 0) {
    return { keywayId: spec.id, cuts: [...spec.defaultCuts] };
  }

  return {
    keywayId: spec.id,
    cuts: clampCutsToSpec(spec, parsed),
  };
}
