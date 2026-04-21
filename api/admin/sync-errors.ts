/**
 * GET  /api/admin/sync-errors          — lista jobs na dead letter queue
 * POST /api/admin/sync-errors/requeue  — recoloca jobs para reprocessamento
 *
 * Auth: Bearer API_KEY
 *
 * Dead letter: jobs que falharam MAX_ATTEMPTS (10) vezes consecutivas.
 * Ficam com status='failed' e podem ser inspecionados ou recolocados manualmente.
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
      { error: 'CLOCK_AGENT_SQLITE_PATH não configurado. Este endpoint requer acesso ao SQLite local.' },
      { status: 503, headers: corsHeaders }
    );
  }

  let SyncQueue: any;
  try {
    const mod = await import('../../services/syncQueue.js' as string);
    SyncQueue = mod.SyncQueue;
  } catch {
    return Response.json(
      { error: 'Módulo de fila não disponível neste ambiente.' },
      { status: 503, headers: corsHeaders }
    );
  }

  const q = new SyncQueue(sqlitePath);

  try {
    // GET — listar dead letter jobs
    if (request.method === 'GET') {
      const url       = new URL(request.url);
      const limit     = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));
      const errorType = url.searchParams.get('error_type') || undefined;
      const jobs      = q.getDeadLetterJobs(limit);
      const metrics   = q.getMetrics();

      const filtered = errorType
        ? jobs.filter((j: { errorType: string }) => j.errorType === errorType)
        : jobs;

      return Response.json(
        {
          timestamp: new Date().toISOString(),
          total_failed: metrics.failed,
          jobs: filtered.map((j: {
            id: string; attempts: number; lastError: string;
            errorType: string; createdAt: string;
            payload: { companyId?: string; deviceId?: string; rows?: unknown[] };
          }) => ({
            id:         j.id,
            attempts:   j.attempts,
            lastError:  j.lastError,
            errorType:  j.errorType,
            createdAt:  j.createdAt,
            companyId:  j.payload?.companyId,
            deviceId:   j.payload?.deviceId,
            batchSize:  j.payload?.rows?.length ?? 0,
          })),
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // POST — requeue jobs
    if (request.method === 'POST') {
      let body: { jobIds?: string[]; all?: boolean } = {};
      try { body = await request.json(); } catch { /* ignore */ }

      let jobIds: string[] = [];

      if (body.all === true) {
        // Recolocar todos os jobs da dead letter
        const jobs = q.getDeadLetterJobs(10_000);
        jobIds = jobs.map((j: { id: string }) => j.id);
      } else if (Array.isArray(body.jobIds)) {
        jobIds = body.jobIds.filter((id: unknown) => typeof id === 'string');
      }

      if (!jobIds.length) {
        return Response.json(
          { error: 'Forneça jobIds[] ou all:true no body.' },
          { status: 400, headers: corsHeaders }
        );
      }

      const requeued = q.requeueDeadLetterJobs(jobIds);
      q.log('info', 'admin', `Requeue manual: ${requeued} job(s) recolocados`, { requeued, jobIds: jobIds.length });

      return Response.json(
        { success: true, requeued, requested: jobIds.length },
        { status: 200, headers: corsHeaders }
      );
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  } finally {
    q.close();
  }
}
