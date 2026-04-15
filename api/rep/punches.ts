/**
 * GET /api/rep/punches?device_id=&since=
 * Proxy para marcações (parseadas) — mesmo fluxo da sincronização no servidor.
 */

import { authenticateRepDeviceRequest, repCorsHeaders } from './repAuth';
import { getPunchesFromDeviceServer } from '../../modules/rep-integration/repDeviceServer';

export default async function handler(request: Request): Promise<Response> {
  const headers = { ...repCorsHeaders(request), 'Content-Type': 'application/json' };

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') {
      return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    const urlObj = new URL(request.url);
    const deviceId = urlObj.searchParams.get('device_id');
    const sinceRaw = urlObj.searchParams.get('since');

    const auth = await authenticateRepDeviceRequest(request, deviceId);
    if (auth instanceof Response) {
      return auth;
    }
    const { device } = auth;

    if (device.tipo_conexao === 'arquivo') {
      return Response.json({ ok: false, message: 'Dispositivo configurado apenas para arquivo.' }, { status: 400, headers });
    }

    let since: Date | undefined;
    if (sinceRaw) {
      const d = new Date(sinceRaw);
      if (!Number.isNaN(d.getTime())) since = d;
    }

    try {
      const punches = await getPunchesFromDeviceServer(device, since);
      try {
        return Response.json({ ok: true, punches }, { status: 200, headers });
      } catch (ser: unknown) {
        console.error('[api/rep/punches] JSON serialize', ser);
        return Response.json(
          { ok: false, message: 'Resposta do relógio não pôde ser serializada (dados inválidos).' },
          { status: 500, headers }
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao ler marcações do relógio';
      return Response.json({ ok: false, message }, { status: 200, headers });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno no proxy REP';
    console.error('[api/rep/punches]', e);
    return Response.json({ ok: false, error: message }, { status: 500, headers });
  }
}
