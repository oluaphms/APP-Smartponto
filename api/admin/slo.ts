/**
 * GET /api/admin/slo
 *
 * SLO/SLA status e error budget.
 * Auth: Bearer API_KEY
 *
 * Retorna:
 * - SLO targets definidos
 * - Conformidade atual
 * - Error budget (30 dias)
 * - Histórico de medições
 * - Flag de freeze de deploys
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  try {
    const [{ SyncQueue }, { SLOTracker, SLO }] = await Promise.all([
      import('../../services/syncQueue.js' as string),
      import('../../services/sloTracker.js' as string),
    ]);

    const url    = new URL(request.url);
    const metric = url.searchParams.get('metric') || undefined;
    const days   = Math.min(90, parseInt(url.searchParams.get('days') || '7', 10));

    const q       = new SyncQueue(sqlitePath);
    const tracker = new SLOTracker({ db: q.db, queue: q });

    const budget  = tracker.getErrorBudget();
    const history = tracker.getHistory({ metric, days });

    q.close();

    return Response.json(
      {
        timestamp: new Date().toISOString(),
        targets:   SLO,
        errorBudget: budget,
        history: {
          days,
          metric: metric ?? 'all',
          count:  history.length,
          data:   history.slice(0, 200),
        },
        alerts: {
          freezeDeploys: budget.freezeDeploys,
          message:       budget.freezeDeploys
            ? '⚠ Error budget esgotado. Deploys devem ser congelados até recuperação do SLO.'
            : budget.status === 'at_risk'
            ? '⚠ Error budget em risco. Monitorar de perto.'
            : '✓ SLO dentro do target.',
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500, headers: corsHeaders }
    );
  }
}
