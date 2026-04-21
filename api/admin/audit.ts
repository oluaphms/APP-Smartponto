/**
 * GET  /api/admin/audit          — consulta trilha de auditoria
 * GET  /api/admin/audit/verify   — verifica integridade da trilha
 * POST /api/admin/audit/snapshot — força snapshot imediato
 *
 * Auth: Bearer API_KEY
 *
 * Query params (GET /audit):
 * - entity:     filtrar por entidade (ex: time_records)
 * - company_id: filtrar por empresa
 * - action:     filtrar por ação (ex: PUNCH_INSERTED)
 * - limit:      número de registros (default 100, max 500)
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    return Response.json(
      { error: 'CLOCK_AGENT_SQLITE_PATH não configurado.' },
      { status: 503, headers: corsHeaders }
    );
  }

  let SyncQueue: any, AuditTrail: any;
  try {
    [{ SyncQueue }, { AuditTrail }] = await Promise.all([
      import('../../services/syncQueue.js' as string),
      import('../../services/auditTrail.js' as string),
    ]);
  } catch {
    return Response.json({ error: 'Módulos não disponíveis.' }, { status: 503, headers: corsHeaders });
  }

  const url      = new URL(request.url);
  const pathname = url.pathname;
  const isVerify   = pathname.endsWith('/verify');
  const isSnapshot = pathname.endsWith('/snapshot') && request.method === 'POST';

  const q  = new SyncQueue(sqlitePath);
  const at = new AuditTrail({ db: q.db });

  try {
    // GET /audit/verify — verificar integridade da trilha
    if (isVerify) {
      const result = at.verifyIntegrity();
      return Response.json(
        {
          timestamp: new Date().toISOString(),
          ...result,
          message: result.ok
            ? 'Trilha de auditoria íntegra — nenhuma adulteração detectada.'
            : `ALERTA: ${result.tampered} registro(s) adulterado(s) detectado(s)!`,
        },
        { status: result.ok ? 200 : 409, headers: corsHeaders }
      );
    }

    // POST /audit/snapshot — forçar snapshot imediato
    if (isSnapshot) {
      const { SnapshotService } = await import('../../services/snapshotService.js' as string);
      const { createClient }    = await import('@supabase/supabase-js');

      const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const serviceKey  = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
      const supabase    = supabaseUrl && serviceKey
        ? createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : null;

      if (!supabase) {
        return Response.json({ error: 'Supabase não configurado.' }, { status: 503, headers: corsHeaders });
      }

      const snap = new SnapshotService({ supabase, queue: q, rawDb: q.db });
      const result = await snap.takeSnapshot();

      at.record({
        entity:      'system',
        action:      'SNAPSHOT_TAKEN',
        after:       result,
        performedBy: 'admin_api',
      });

      return Response.json(
        { success: true, ...result },
        { status: 200, headers: corsHeaders }
      );
    }

    // GET /audit — consultar trilha
    const entity    = url.searchParams.get('entity')     || undefined;
    const companyId = url.searchParams.get('company_id') || undefined;
    const action    = url.searchParams.get('action')     || undefined;
    const limit     = Math.min(500, parseInt(url.searchParams.get('limit') || '100', 10));

    const entries = at.query({ entity, companyId, action, limit });

    return Response.json(
      {
        timestamp: new Date().toISOString(),
        count:     entries.length,
        entries,
      },
      { status: 200, headers: corsHeaders }
    );

  } finally {
    q.close();
  }
}
