/**
 * Control iD — API REP iDClass (documentação: api_idclass / *.fcgi).
 * Não usa /api/v1/punches: sessão via POST /login.fcgi e marcações via POST /get_afd.fcgi (AFD).
 */

import type {
  RepDevice,
  RepVendorAdapter,
  PunchFromDevice,
  RepConnectionTestResult,
  RepEmployeePayload,
  RepDeviceClockSet,
  RepUserFromDevice,
} from '../types';
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

function digitsOnly(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Dígito verificador PIS/PASEP (NIS), 11 dígitos. */
function validPisPasep11(d: string): boolean {
  const x = digitsOnly(d);
  if (x.length !== 11) return false;
  const digits = x.split('').map((c) => parseInt(c, 10));
  const w = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 10; i++) s += digits[i] * w[i]!;
  const r = s % 11;
  const dv = r < 2 ? 0 : 11 - r;
  return dv === digits[10];
}

/**
 * Control iD: em modo legado, `pis` deve ser PIS com dígitos verificadores válidos
 * (um CPF no campo PIS gera "pis em formato incorreto").
 * Se houver CPF com 11 dígitos (ou 11 dígitos no PIS que não sejam PIS válido), usamos
 * `add_users`/`update_users` com `mode=671` e campo `cpf` (documentação Control iD).
 * O DV de CPF não é exigido aqui: muitos cadastros usam número de 11 dígitos aceito pelo relógio.
 */
function resolveControlIdIdentity(
  configMode671: boolean,
  cpfDigits: string,
  pisDigits: string
):
  | { ok: true; use671Api: boolean; idDigits: string }
  | { ok: false; message: string } {
  if (configMode671) {
    if (cpfDigits.length !== 11) {
      return {
        ok: false,
        message:
          'CPF com 11 dígitos é obrigatório para cadastrar no relógio (modo Portaria 671 ativo nas configurações).',
      };
    }
    return { ok: true, use671Api: true, idDigits: cpfDigits };
  }
  /** PIS válido: API legado com campo `pis`. */
  if (pisDigits.length === 11 && validPisPasep11(pisDigits)) {
    return { ok: true, use671Api: false, idDigits: pisDigits };
  }
  /** CPF com 11 dígitos: API 671 com campo `cpf` (inclui número sem DV válido localmente). */
  if (cpfDigits.length === 11) {
    return { ok: true, use671Api: true, idDigits: cpfDigits };
  }
  /** Só PIS preenchido: 11 dígitos que não passam no PIS costumam ser CPF digitado no campo errado. */
  if (pisDigits.length === 11) {
    return { ok: true, use671Api: true, idDigits: pisDigits };
  }
  return {
    ok: false,
    message:
      'Informe PIS/PASEP com 11 dígitos válidos (dígitos verificadores corretos) ou CPF com 11 dígitos. ' +
      'Se o identificador no relógio é o CPF, prefira preencher o CPF no cadastro e deixe o PIS vazio ou use «AFD Portaria 671» no relógio.',
  };
}

/** Resposta HTTP 2xx sem campo error útil = sucesso (APIs fcgi costumam devolver JSON vazio). */
function controlIdJsonIndicatesSuccess(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const err = j.error ?? j.message;
    if (err == null) return true;
    const s = String(err).trim();
    return s === '' || s === 'null';
  } catch {
    return true;
  }
}

/** use671Api: JSON com `cpf`; senão `pis` (modo legado Control iD). */
function buildUserPayloadForAddAndUpdate(
  use671Api: boolean,
  nome: string,
  idDigits: string,
  matDigits: string
): { add: Record<string, unknown>; update: Record<string, unknown> } {
  const add: Record<string, unknown> = { name: nome };
  const update: Record<string, unknown> = { name: nome };
  const n = parseInt(idDigits, 10);
  if (use671Api) {
    add.cpf = n;
    update.cpf = n;
  } else {
    add.pis = n;
    update.pis = n;
  }
  if (matDigits) {
    const reg = parseInt(matDigits, 10);
    if (!Number.isNaN(reg) && reg > 0) {
      add.registration = reg;
      update.registration = reg;
    }
  }
  return { add, update };
}

function normalizeLoadUser(u: Record<string, unknown>, _mode671: boolean): RepUserFromDevice {
  const name = typeof u.name === 'string' ? u.name : '';
  const pis = u.pis != null ? String(u.pis) : '';
  const cpf = u.cpf != null ? String(u.cpf) : '';
  const reg = u.registration != null ? String(u.registration) : '';
  return {
    nome: name,
    pis: pis || undefined,
    cpf: cpf || undefined,
    matricula: reg || undefined,
    raw: u,
  };
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

  async pushEmployee(device: RepDevice, employee: RepEmployeePayload): Promise<{ ok: boolean; message: string }> {
    if (!device.ip) {
      return { ok: false, message: 'IP não configurado' };
    }
    const nome = (employee.nome || '').trim();
    if (!nome) {
      return { ok: false, message: 'Nome do funcionário é obrigatório.' };
    }
    const logged = await controlIdLogin(device);
    if ('error' in logged) {
      return { ok: false, message: logged.error };
    }
    const ex = extra(device);
    const configMode671 = ex.mode_671 === true;
    const cpfDigits = digitsOnly(employee.cpf);
    const pisDigits = digitsOnly(employee.pis);
    const resolved = resolveControlIdIdentity(configMode671, cpfDigits, pisDigits);
    if (!resolved.ok) {
      return { ok: false, message: resolved.message };
    }
    const { use671Api, idDigits } = resolved;

    const matDigits = digitsOnly(employee.matricula);
    const { add: userAdd, update: userUpdate } = buildUserPayloadForAddAndUpdate(
      use671Api,
      nome,
      idDigits,
      matDigits
    );

    let addPath = `/add_users.fcgi?session=${encodeURIComponent(logged.session)}`;
    if (use671Api) addPath += '&mode=671';

    const addRes = await deviceFetch(device, addPath, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ do_match: false, users: [userAdd] }),
    });
    const addText = await addRes.text();
    if (addRes.ok && controlIdJsonIndicatesSuccess(addText)) {
      return { ok: true, message: 'Funcionário cadastrado no relógio (Control iD).' };
    }

    let updPath = `/update_users.fcgi?session=${encodeURIComponent(logged.session)}`;
    if (use671Api) updPath += '&mode=671';

    const updRes = await deviceFetch(device, updPath, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ do_match: false, users: [userUpdate] }),
    });
    const updText = await updRes.text();
    if (updRes.ok && controlIdJsonIndicatesSuccess(updText)) {
      return { ok: true, message: 'Funcionário já estava no relógio; cadastro atualizado (Control iD).' };
    }

    const addHint = addRes.ok ? addText.slice(0, 280) : `HTTP ${addRes.status} — ${addText.slice(0, 280)}`;
    const updHint = updRes.ok ? updText.slice(0, 280) : `HTTP ${updRes.status} — ${updText.slice(0, 280)}`;
    return {
      ok: false,
      message: `Control iD: inclusão falhou (${addHint}). Atualização também falhou (${updHint})`,
    };
  },

  async pullClock(device: RepDevice): Promise<{ ok: boolean; message?: string; data?: unknown }> {
    if (!device.ip) return { ok: false, message: 'IP não configurado' };
    const logged = await controlIdLogin(device);
    if ('error' in logged) return { ok: false, message: logged.error };
    const mode671 = extra(device).mode_671 === true;
    let path = `/get_system_date_time.fcgi?session=${encodeURIComponent(logged.session)}`;
    if (mode671) path += '&mode=671';
    const res = await deviceFetch(device, path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `get_system_date_time: HTTP ${res.status} — ${text.slice(0, 240)}` };
    }
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      return { ok: true, data: text };
    }
  },

  async pushClock(device: RepDevice, clock: RepDeviceClockSet): Promise<{ ok: boolean; message: string }> {
    if (!device.ip) return { ok: false, message: 'IP não configurado' };
    const logged = await controlIdLogin(device);
    if ('error' in logged) return { ok: false, message: logged.error };
    const mode671 = extra(device).mode_671 === true;
    const body: Record<string, unknown> = {
      day: clock.day,
      month: clock.month,
      year: clock.year,
      hour: clock.hour,
      minute: clock.minute,
      second: clock.second,
    };
    if (mode671 && clock.timezone) {
      body.timezone = clock.timezone;
    }
    let path = `/set_system_date_time.fcgi?session=${encodeURIComponent(logged.session)}`;
    if (mode671) path += '&mode=671';
    const res = await deviceFetch(device, path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `set_system_date_time: HTTP ${res.status} — ${text.slice(0, 300)}` };
    }
    if (text.trim() && !controlIdJsonIndicatesSuccess(text)) {
      return { ok: false, message: text.slice(0, 300) };
    }
    return { ok: true, message: 'Data e hora gravadas no relógio (Control iD).' };
  },

  async pullDeviceInfo(device: RepDevice): Promise<{ ok: boolean; message?: string; data?: unknown }> {
    if (!device.ip) return { ok: false, message: 'IP não configurado' };
    const logged = await controlIdLogin(device);
    if ('error' in logged) return { ok: false, message: logged.error };
    const path = `/get_info.fcgi?session=${encodeURIComponent(logged.session)}`;
    const res = await deviceFetch(device, path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `get_info: HTTP ${res.status} — ${text.slice(0, 240)}` };
    }
    try {
      return { ok: true, data: JSON.parse(text) as unknown };
    } catch {
      return { ok: true, data: text };
    }
  },

  async pullUsersFromDevice(device: RepDevice): Promise<{ ok: boolean; message?: string; users: RepUserFromDevice[] }> {
    const collected: RepUserFromDevice[] = [];
    if (!device.ip) return { ok: false, message: 'IP não configurado', users: [] };
    const logged = await controlIdLogin(device);
    if ('error' in logged) return { ok: false, message: logged.error, users: [] };
    const mode671 = extra(device).mode_671 === true;
    const limit = 100;
    let offset = 0;
    for (;;) {
      let path = `/load_users.fcgi?session=${encodeURIComponent(logged.session)}`;
      if (mode671) path += '&mode=671';
      const res = await deviceFetch(device, path, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, offset }),
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          message: `load_users: HTTP ${res.status} — ${text.slice(0, 240)}`,
          users: collected,
        };
      }
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return { ok: false, message: 'load_users: resposta não é JSON.', users: collected };
      }
      const batch = Array.isArray(data.users) ? (data.users as Record<string, unknown>[]) : [];
      for (const row of batch) {
        collected.push(normalizeLoadUser(row, mode671));
      }
      if (batch.length < limit) break;
      offset += limit;
    }
    return { ok: true, users: collected };
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
