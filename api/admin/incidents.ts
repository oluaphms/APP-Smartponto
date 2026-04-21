/**
 * GET  /api/admin/incidents         — lista incidentes
 * POST /api/admin/incidents         — abre novo incidente
 * PATCH /api/admin/incidents/:id    — atualiza incidente
 *
 * Auth: Bearer API_KEY
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function authOk(request: Request): boolean {
  const apiKey = (process.env.CLOCK_AGENT_API_KEY || process.env.API_KEY || '').trim();
  if (!apiKey) return false;
  const auth  = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const xKey  = request.headers.get('x-api-key') || '';
  return token === apiKey || xKey === apiKey;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!authOk(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const sqlitePath = (process.env.CLOCK_AGENT_SQLITE_PATH || '').trim();
  if (!sqlitePath) {
    return Response.json({ error: 'CLOCK_AGENT_SQLITE_PATH não configurado.' }, { status: 503, headers: corsHeaders });
  }

  let SyncQueue: any, IncidentManager: any;
  try {
    [{ SyncQueue }, { IncidentManager }] = await Promise.all([
      import('../../services/syncQueue.js' as string),
      import('../../services/incidentManager.js' as string),
    ]);
  } catch {
    return Response.json({ error: 'Módulos não disponíveis.' }, { status: 503, headers: corsHeaders });
  }

  const q  = new SyncQueue(sqlitePath);
  const im = new IncidentManager({ db: q.db, queue: q });

  try {
    const url      = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const incidentId = pathParts[pathParts.length - 1];
    const isSpecific = incidentId && incidentId.startsWith('INCIDENT-');

    // GET — listar ou buscar
    if (request.method === 'GET') {
      if (isSpecific) {
        const incident = im.get(incidentId);
        if (!incident) return Response.json({ error: 'Incidente não encontrado.' }, { status: 404, headers: corsHeaders });
        return Response.json(incident, { status: 200, headers: corsHeaders });
      }

      const status   = url.searchParams.get('status')   || undefined;
      const severity = url.searchParams.get('severity') || undefined;
      const limit    = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));
      const incidents = im.list({ status, severity, limit });

      return Response.json(
        { timestamp: new Date().toISOString(), count: incidents.length, incidents },
        { status: 200, headers: corsHeaders }
      );
    }

    // POST — abrir incidente
    if (request.method === 'POST') {
      let body: { title?: string; severity?: string; cause?: string; impact?: string; affectedTenants?: string[] } = {};
      try { body = await request.json(); } catch { /* ignore */ }

      if (!body.title || !body.severity) {
        return Response.json({ error: 'title e severity são obrigatórios.' }, { status: 400, headers: corsHeaders });
      }

      const id = im.open({
        title:            body.title,
        severity:         body.severity,
        cause:            body.cause,
        impact:           body.impact,
        affectedTenants:  body.affectedTenants,
      });

      return Response.json(
        { success: true, id, incident: im.get(id) },
        { status: 201, headers: corsHeaders }
      );
    }

    // PATCH — atualizar incidente
    if (request.method === 'PATCH' && isSpecific) {
      let body: { status?: string; mitigation?: string; resolution?: string; cause?: string } = {};
      try { body = await request.json(); } catch { /* ignore */ }

      im.update(incidentId, body);
      return Response.json(
        { success: true, incident: im.get(incidentId) },
        { status: 200, headers: corsHeaders }
      );
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  } finally {
    q.close();
  }
}
