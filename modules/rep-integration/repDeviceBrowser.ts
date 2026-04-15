/**
 * Chamadas ao relógio via backend same-origin (/api/rep/*) — uso apenas no browser.
 */

import type { PunchFromDevice } from './types';

function apiOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export async function fetchPunchesViaApi(
  deviceId: string,
  since: Date | undefined,
  accessToken: string
): Promise<PunchFromDevice[]> {
  const u = new URL('/api/rep/punches', apiOrigin());
  u.searchParams.set('device_id', deviceId);
  if (since) u.searchParams.set('since', since.toISOString());
  const res = await fetch(u.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = (await res.json()) as { ok?: boolean; punches?: PunchFromDevice[]; message?: string };
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  if (data.ok === false) {
    throw new Error(data.message || 'Falha ao obter marcações do relógio');
  }
  return Array.isArray(data.punches) ? data.punches : [];
}

export async function testConnectionViaApi(deviceId: string, accessToken: string): Promise<{ ok: boolean; message: string }> {
  const u = new URL('/api/rep/status', apiOrigin());
  u.searchParams.set('device_id', deviceId);
  const res = await fetch(u.toString(), {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const data = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok) {
    return { ok: false, message: data.message || `HTTP ${res.status}` };
  }
  if (data.ok === false) {
    return { ok: false, message: data.message || 'Falha ao contatar o relógio' };
  }
  return { ok: true, message: data.message || 'Conexão OK' };
}
