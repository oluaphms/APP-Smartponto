#!/usr/bin/env node
/**
 * Agente local (rede da empresa): lê o relógio em HTTP na LAN e envia marcações ao SaaS.
 * Fluxo: Relógio → este script → POST https://seu-app.vercel.app/api/rep/punch → Supabase
 *
 * Variáveis de ambiente:
 *   REP_SAAS_URL     URL base do app (ex: https://chrono-digital.vercel.app)
 *   API_KEY          Mesma chave das APIs serverless (Authorization: Bearer)
 *   REP_DEVICE_IP    IP do relógio (ex: 192.168.0.38)
 *   REP_DEVICE_PORT  Porta (default 80)
 *   REP_COMPANY_ID   UUID da empresa (public.companies ou tenant)
 *   REP_DEVICE_ID    (opcional) UUID do rep_devices cadastrado no painel
 *
 * Uso: npm run rep:agent
 */

const saas = (process.env.REP_SAAS_URL || '').replace(/\/$/, '');
const apiKey = (process.env.API_KEY || process.env.REP_API_KEY || '').trim();
const ip = (process.env.REP_DEVICE_IP || '').trim();
const port = (process.env.REP_DEVICE_PORT || '80').trim();
const companyId = (process.env.REP_COMPANY_ID || '').trim();
const deviceId = (process.env.REP_DEVICE_ID || '').trim() || undefined;

function fail(msg) {
  console.error(`[rep-agent] ${msg}`);
  process.exit(1);
}

if (!saas) fail('Defina REP_SAAS_URL');
if (!apiKey) fail('Defina API_KEY (ou REP_API_KEY)');
if (!ip) fail('Defina REP_DEVICE_IP');
if (!companyId) fail('Defina REP_COMPANY_ID');

function normalizeTipo(t) {
  const u = String(t || 'E').toUpperCase();
  if (u.startsWith('E') || u === 'IN' || u === '1') return 'E';
  if (u.startsWith('S') || u === 'OUT' || u === '2') return 'S';
  if (u.startsWith('P') || u === 'BREAK' || u === '3') return 'P';
  return u.slice(0, 1);
}

function pickDataHora(p) {
  const v = p.timestamp ?? p.data_hora ?? p.datetime;
  return v ? new Date(v).toISOString() : null;
}

async function fetchPunchesFromClock() {
  const base = `http://${ip}:${port}`;
  const urls = [`${base}/api/punches`, `${base}/api/v1/punches`];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} em ${url}`);
        continue;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.punches || data.records || data.data || [];
      if (Array.isArray(list)) return { list, url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Não foi possível ler /api/punches do relógio');
}

async function postPunch(body) {
  const res = await fetch(`${saas}/api/rep/punch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || text || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  console.log('[rep-agent] Lendo relógio em', `http://${ip}:${port}/api/punches`);
  const { list, url } = await fetchPunchesFromClock();
  console.log('[rep-agent] Endpoint OK:', url, '| registros:', list.length);

  let ok = 0;
  let skip = 0;
  for (const p of list) {
    const data_hora = pickDataHora(p);
    if (!data_hora) {
      skip += 1;
      continue;
    }
    const body = {
      company_id: companyId,
      device_id: deviceId,
      data_hora,
      tipo_marcacao: normalizeTipo(p.tipo ?? p.type),
      pis: p.pis ?? p.pisPasep ?? undefined,
      cpf: p.cpf ?? undefined,
      matricula: p.matricula ?? p.badge ?? undefined,
      nsr: typeof p.nsr === 'number' ? p.nsr : undefined,
    };
    try {
      const r = await postPunch(body);
      if (r.success === false && r.duplicate) skip += 1;
      else ok += 1;
    } catch (e) {
      console.error('[rep-agent] Erro ao enviar marcação:', e.message, body);
    }
  }
  console.log('[rep-agent] Concluído. Enviados OK:', ok, '| ignorados/duplicados:', skip);
}

main().catch((e) => {
  console.error('[rep-agent]', e);
  process.exit(1);
});
