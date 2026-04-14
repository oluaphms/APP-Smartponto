/**
 * Geocodificação reversa (lat/lng → endereço legível).
 * Em produção (e no dev com middleware Vite), usa /api/reverse-geocode para evitar CORS do Photon.
 * Cache em memória para reduzir requisições.
 */

const CACHE = new Map<string, string>();
const CACHE_MAX = 400;

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function pairFromNumbers(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

/**
 * Extrai lat/lng de uma linha `time_records` (colunas diretas, JSON `location`, GeoJSON, string JSON).
 */
export function extractLatLng(row: any): { lat: number; lng: number } | null {
  if (!row || typeof row !== 'object') return null;

  const direct = pairFromNumbers(row.latitude ?? row.lat, row.longitude ?? row.lng ?? row.lon);
  if (direct) return direct;

  let loc: unknown = row.location;
  if (typeof loc === 'string') {
    try {
      loc = JSON.parse(loc) as unknown;
    } catch {
      loc = null;
    }
  }

  if (loc && typeof loc === 'object') {
    const g = loc as Record<string, unknown>;
    // GeoJSON Point: coordinates [lng, lat]
    if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const ln = Number(g.coordinates[0]);
      const la = Number(g.coordinates[1]);
      if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
    }
    // PostGIS / alguns drivers
    const geom = g.geometry;
    if (geom && typeof geom === 'object') {
      const gg = geom as Record<string, unknown>;
      if (gg.type === 'Point' && Array.isArray(gg.coordinates) && gg.coordinates.length >= 2) {
        const ln = Number(gg.coordinates[0]);
        const la = Number(gg.coordinates[1]);
        if (Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
      }
    }
    const nested = pairFromNumbers(
      g.lat ?? g.latitude,
      g.lng ?? g.lon ?? g.longitude,
    );
    if (nested) return nested;
  }

  return null;
}

function getOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3010';
}

/**
 * Fallback quando /api/reverse-geocode falha (504, rede, etc.).
 * Não chama Photon/Nominatim no browser — CORS bloqueia em produção.
 */
async function resolveAddressFromCoordinates(_lat: number, _lng: number): Promise<string> {
  return 'Endereço indisponível (tente recarregar ou verifique o mapa)';
}

/**
 * Retorna texto de endereço (rua, bairro, cidade). Sem coordenadas.
 * Em falha ou área sem dados, mensagem neutra — não expõe lat/lng.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = cacheKey(lat, lng);
  if (CACHE.has(key)) return CACHE.get(key)!;

  let text = '';
  const FETCH_MS = 12000;
  try {
    const u = new URL('/api/reverse-geocode', getOrigin());
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lng));
    const ctrl = new AbortController();
    const tid =
      typeof window !== 'undefined' ? window.setTimeout(() => ctrl.abort(), FETCH_MS) : undefined;
    const res = await fetch(u.toString(), {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (typeof window !== 'undefined' && tid !== undefined) window.clearTimeout(tid);
    if (res.ok) {
      const data = (await res.json()) as { address?: string };
      if (typeof data.address === 'string') text = data.address.trim();
    }
  } catch {
    text = '';
  }

  if (!text) {
    text = await resolveAddressFromCoordinates(lat, lng);
  }

  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first !== undefined) CACHE.delete(first);
  }
  CACHE.set(key, text);
  return text;
}
