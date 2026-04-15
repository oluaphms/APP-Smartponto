/**
 * Chamadas ao relógio via backend same-origin (/api/rep/*) — uso apenas no browser.
 */

import type { PunchFromDevice, RepDeviceClockSet, RepExchangeOp, RepUserFromDevice } from './types';

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

/** Cadastra funcionário no relógio (fabricante com suporte, ex.: Control iD). */
export async function pushEmployeeToDeviceViaApi(
  deviceId: string,
  userId: string,
  accessToken: string
): Promise<{ ok: boolean; message: string }> {
  const u = new URL('/api/rep/push-employee', apiOrigin());
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_id: deviceId, user_id: userId }),
  });
  const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) {
    return { ok: false, message: data.error || data.message || `HTTP ${res.status}` };
  }
  if (data.ok === false) {
    return { ok: false, message: data.message || 'Falha ao enviar funcionário ao relógio' };
  }
  return { ok: true, message: data.message || 'Funcionário enviado ao relógio.' };
}

/** Envia/recebe dados auxiliares (hora, info, lista de usuários no relógio). */
export async function repExchangeViaApi(
  deviceId: string,
  op: RepExchangeOp,
  accessToken: string,
  clock?: RepDeviceClockSet
): Promise<{
  ok: boolean;
  message?: string;
  data?: unknown;
  users?: RepUserFromDevice[];
  error?: string;
}> {
  const u = new URL('/api/rep/exchange', apiOrigin());
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_id: deviceId, op, ...(clock ? { clock } : {}) }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    message?: string;
    data?: unknown;
    users?: RepUserFromDevice[];
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error || data.message || `HTTP ${res.status}` };
  }
  if (data.ok === false) {
    const err = data.error || data.message || 'Operação não concluída.';
    return { ok: false, message: err, error: err, data: data.data, users: data.users };
  }
  return {
    ok: true,
    message: data.message,
    data: data.data,
    users: data.users,
  };
}
