/**
 * POST /api/create-employee-auth
 * Body: { email: string, password: string, metadata?: object }
 * Header: Authorization: Bearer <jwt do admin>
 *
 * Cria um usuário no Supabase Auth via service_role sem trocar a sessão do admin no client.
 * Também marca email_confirm=true para permitir login imediato.
 *
 * Variáveis de ambiente (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
 * SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) para validar o JWT do admin.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const serviceKey =
    (typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? process.env.SUPABASE_SERVICE_ROLE_KEY : '').trim();
  const supabaseUrl = (typeof process.env.SUPABASE_URL === 'string'
    ? process.env.SUPABASE_URL
    : (process.env.VITE_SUPABASE_URL as string) || ''
  )
    .toString()
    .trim()
    .replace(/\/$/, '');
  const anonKey =
    (typeof process.env.SUPABASE_ANON_KEY === 'string'
      ? process.env.SUPABASE_ANON_KEY
      : (process.env.VITE_SUPABASE_ANON_KEY as string) || ''
    ).trim();

  if (!serviceKey || !supabaseUrl) {
    return Response.json(
      { error: 'Configuração indisponível.', code: 'CONFIG_MISSING' },
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return Response.json(
      { error: 'Token de autenticação obrigatório.', code: 'UNAUTHORIZED' },
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: { email?: string; password?: string; metadata?: any } = {};
  try {
    const raw = await request.json();
    body = (raw && typeof raw === 'object' ? raw : {}) as typeof body;
  } catch {
    return Response.json(
      { error: 'Body inválido.', code: 'BAD_REQUEST' },
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;

  if (!email || !email.includes('@')) {
    return Response.json(
      { error: 'E-mail é obrigatório.', code: 'BAD_REQUEST' },
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  if (!password || password.trim().length < 6) {
    return Response.json(
      { error: 'Senha inválida (mínimo 6 caracteres).', code: 'BAD_REQUEST' },
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const adminSup = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar se o caller é admin ou hr (validar JWT via Auth REST e depois role em public.users)
    let callerRole: string | null = null;
    if (anonKey) {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${jwt}`, apikey: anonKey },
      });
      if (authRes.ok) {
        const authUser = await authRes.json();
        const callerId = authUser?.id;
        if (callerId) {
          // Busca por id (admin antigo) ou auth_user_id (admin com id local)
          const byId = await adminSup.from('users').select('role').eq('id', callerId).maybeSingle();
          const byAuthId = await adminSup.from('users').select('role').eq('auth_user_id', callerId).maybeSingle();
          const row = byId?.data ?? byAuthId?.data;
          if (row?.role) callerRole = String(row.role).toLowerCase();
        }
      }
    }
    if (callerRole !== 'admin' && callerRole !== 'hr') {
      return Response.json(
        { error: 'Apenas administrador ou RH pode cadastrar funcionário.', code: 'FORBIDDEN' },
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const adminAuth = (adminSup.auth as any)?.admin;
    if (!adminAuth || typeof adminAuth.createUser !== 'function') {
      return Response.json(
        { error: 'Configuração do Auth admin indisponível.', code: 'ADMIN_AUTH_MISSING' },
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data, error } = await adminAuth.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      return Response.json(
        { error: error.message || 'Falha ao criar usuário no Auth.', code: 'CREATE_FAILED' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const userId = data?.user?.id;
    if (!userId) {
      return Response.json(
        { error: 'Conta criada mas ID não retornado.', code: 'NO_ID' },
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return Response.json(
      { success: true, userId },
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    const errMsg = e?.message || String(e) || 'Erro interno.';
    return Response.json(
      { error: errMsg, code: 'INTERNAL_ERROR' },
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

