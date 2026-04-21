/**
 * GET  /api/admin/flags        — lista feature flags e seus valores atuais
 * POST /api/admin/flags        — atualiza flag via env (apenas documenta; requer restart)
 *
 * Auth: Bearer API_KEY
 *
 * Para flags dinâmicas (sem restart), configure a tabela `feature_flags` no Supabase:
 * CREATE TABLE feature_flags (name TEXT PRIMARY KEY, enabled BOOLEAN, active BOOLEAN DEFAULT true);
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

  const { FeatureFlags } = await import('../../services/featureFlags.js' as string);
  const ff = new FeatureFlags();

  if (request.method === 'GET') {
    return Response.json(
      {
        timestamp: new Date().toISOString(),
        ...ff.getStatus(),
        instructions: {
          envOverride:    'Defina a variável de ambiente com o nome da flag (ex: ENABLE_RECONCILER=0)',
          dynamicUpdate:  'Insira/atualize na tabela `feature_flags` do Supabase para mudança sem restart',
          maintenanceMode:'MAINTENANCE_MODE=1 bloqueia ingestão de novas batidas',
        },
      },
      { status: 200, headers: corsHeaders }
    );
  }

  if (request.method === 'POST') {
    // Documentar a mudança — a aplicação real requer restart ou tabela Supabase
    let body: { flag?: string; enabled?: boolean } = {};
    try { body = await request.json(); } catch { /* ignore */ }

    if (!body.flag) {
      return Response.json({ error: 'Campo "flag" obrigatório.' }, { status: 400, headers: corsHeaders });
    }

    const current = ff.get(body.flag);
    return Response.json(
      {
        flag:    body.flag,
        current,
        message: `Para alterar "${body.flag}", defina a variável de ambiente ou atualize a tabela feature_flags no Supabase. Mudanças via env requerem restart do agente.`,
        supabaseSql: `INSERT INTO feature_flags (name, enabled, active) VALUES ('${body.flag}', ${body.enabled ?? !current}, true) ON CONFLICT(name) DO UPDATE SET enabled = ${body.enabled ?? !current};`,
      },
      { status: 200, headers: corsHeaders }
    );
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
}
