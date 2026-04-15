/**
 * GET /api/rep/status?device_id=
 * Proxy same-origin para GET http://IP:porta/api/status no relógio (sem mixed content no browser).
 */

import { authenticateRepDeviceRequest, repCorsHeaders } from './repAuth';
import { runRepConnectionTest } from '../../modules/rep-integration/repDeviceServer';

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

    const auth = await authenticateRepDeviceRequest(request, deviceId);
    if (auth instanceof Response) {
      return auth;
    }
    const { device } = auth;

    if (device.tipo_conexao !== 'rede') {
      return Response.json({ ok: false, message: 'Dispositivo não é do tipo rede (IP).' }, { status: 400, headers });
    }

    const r = await runRepConnectionTest(device);
    if (!r.ok && (r.httpStatus === 0 || r.httpStatus === undefined) && r.message) {
      /** 200 evita "Bad Gateway" no browser; o painel usa `ok: false` + `message`. */
      return Response.json({ ok: false, message: r.message }, { status: 200, headers });
    }

    return Response.json(
      {
        ok: r.ok,
        message: r.message || (r.ok ? 'Conexão OK' : 'Falha'),
        httpStatus: r.httpStatus ?? (r.ok ? 200 : 0),
        body: r.body,
      },
      { status: 200, headers }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno no proxy REP (status)';
    console.error('[api/rep/status]', e);
    return Response.json({ ok: false, error: message }, { status: 500, headers });
  }
}
