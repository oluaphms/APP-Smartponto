/**
 * Control iD — API REP iDClass (documentação: api_idclass / *.fcgi).
 * Não usa /api/v1/punches: sessão via POST /login.fcgi e marcações via POST /get_afd.fcgi (AFD).
 */

import type { RepDevice, RepVendorAdapter, PunchFromDevice, RepConnectionTestResult } from '../types';
import { deviceFetch } from '../repDeviceHttp';
import { parseAFD, afdRecordToIsoDateTime } from '../repParser';

function extra(device: RepDevice): Record<string, unknown> {
  return device.config_extra && typeof device.config_extra === 'object'
    ? (device.config_extra as Record<string, unknown>)
    : {};
}

function credentials(device: RepDevice): { login: string; password: string } {
  const ex = extra(device);
  return {
    login: String(ex.rep_login ?? ex.login ?? 'admin'),
    password: String(ex.rep_password ?? ex.password ?? 'admin'),
  };
}

async function controlIdLogin(device: RepDevice): Promise<{ session: string } | { error: string }> {
  const { login, password } = credentials(device);
  const res = await deviceFetch(device, '/login.fcgi', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { error: `Login Control iD: HTTP ${res.status} — ${text.slice(0, 240)}` };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'Login Control iD: resposta não é JSON. Confirme HTTPS, porta (443) e credenciais.' };
  }
  const o = data as Record<string, unknown>;
  const session = o.session;
  if (typeof session !== 'string' || !session) {
    return {
      error: `Login Control iD: campo "session" ausente. Resposta: ${JSON.stringify(data).slice(0, 240)}`,
    };
  }
  return { session };
}

/** Corpo do get_afd pode ser texto AFD puro ou JSON com campo de conteúdo. */
function extractAfdFileText(text: string): string {
  const t = text.trim();
  if (!t.startsWith('{')) return text;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    for (const k of ['afd', 'AFD', 'data', 'file', 'content', 'nfo']) {
      const v = j[k];
      if (typeof v === 'string' && v.length > 50) return v;
    }
  } catch {
    /* usar texto bruto */
  }
  return text;
}

function normalizeTipo(t: string): string {
  const u = (t || 'E').toString().toUpperCase();
  if (u.startsWith('E') || u === 'IN' || u === '1') return 'E';
  if (u.startsWith('S') || u === 'OUT' || u === '2') return 'S';
  if (u.startsWith('P') || u === 'BREAK' || u === '3') return 'P';
  return u.slice(0, 1);
}

const ControlIdAdapter: RepVendorAdapter = {
  name: 'Control iD',

  async testConnection(device: RepDevice): Promise<RepConnectionTestResult> {
    if (!device.ip) {
      return { ok: false, message: 'IP não configurado' };
    }
    const logged = await controlIdLogin(device);
    if ('error' in logged) {
      return { ok: false, message: logged.error };
    }
    const path = `/get_info.fcgi?session=${encodeURIComponent(logged.session)}`;
    const res = await deviceFetch(device, path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const hint =
        typeof body === 'object' && body !== null && 'error' in (body as object)
          ? ` — ${JSON.stringify((body as Record<string, unknown>).error)}`
          : ` — ${text.slice(0, 200)}`;
      return {
        ok: false,
        message: `Control iD get_info: HTTP ${res.status}${hint}`,
        httpStatus: res.status,
        body,
      };
    }
    return {
      ok: true,
      message: 'Conexão OK (Control iD iDClass)',
      httpStatus: res.status,
      body,
    };
  },

  async fetchPunches(device: RepDevice, since?: Date): Promise<PunchFromDevice[]> {
    if (!device.ip) return [];
    const logged = await controlIdLogin(device);
    if ('error' in logged) {
      throw new Error(logged.error);
    }
    const ex = extra(device);
    const mode671 = ex.mode_671 === true;
    let path = `/get_afd.fcgi?session=${encodeURIComponent(logged.session)}`;
    if (mode671) {
      path += '&mode=671';
    }
    const bodyPayload: Record<string, unknown> = {};
    const lastNsr = ex.last_afd_nsr;
    if (typeof lastNsr === 'number' && lastNsr > 0) {
      bodyPayload.initial_nsr = Math.floor(lastNsr);
    }

    const res = await deviceFetch(device, path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Control iD get_afd: HTTP ${res.status} — ${text.slice(0, 280)}`);
    }
    const afdText = extractAfdFileText(text);
    let records = parseAFD(afdText);
    if (since) {
      const sinceMs = since.getTime();
      records = records.filter((rec) => {
        const iso = afdRecordToIsoDateTime(rec);
        const t = new Date(iso).getTime();
        return !Number.isNaN(t) && t > sinceMs;
      });
    }
    return records.map((rec) => ({
      pis: rec.cpfOuPis,
      cpf: rec.cpfOuPis,
      data_hora: afdRecordToIsoDateTime(rec),
      tipo: normalizeTipo(rec.tipo),
      nsr: rec.nsr,
      raw: { ...rec, source: 'controlid_afd' },
    }));
  },
};

export default ControlIdAdapter;
