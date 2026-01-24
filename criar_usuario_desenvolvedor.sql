-- ============================================================
-- Criar usuário "Desenvolvedor" com acesso admin e employee
-- ============================================================
-- 
-- IMPORTANTE: Este script assume que o usuário já foi criado
-- no Supabase Auth (Authentication → Users → Add user)
-- 
-- Passos:
-- 1. Vá em Authentication → Users → Add user
-- 2. Email: desenvolvedor@smartponto.com
-- 3. Senha: dev123
-- 4. Auto Confirm User: SIM (para não precisar confirmar email)
-- 5. Depois execute este SQL
-- ============================================================

-- Primeiro, vamos obter o ID do usuário criado no Auth
DO $$
DECLARE
  auth_user_id UUID;
  company_id_val TEXT := 'comp_1'; -- Ajuste para o ID da sua empresa (ou deixe vazio se não tiver)
BEGIN
  -- Buscar ID do usuário no auth.users
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = 'desenvolvedor@smartponto.com'
  LIMIT 1;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no auth.users. Crie primeiro em Authentication → Users';
  END IF;

  -- Inserir ou atualizar na tabela users com role 'admin'
  INSERT INTO users (
    id,
    nome,
    email,
    cargo,
    role,
    company_id,
    department_id,
    preferences,
    created_at,
    updated_at
  ) VALUES (
    auth_user_id,
    'Desenvolvedor',
    'desenvolvedor@smartponto.com',
    'Desenvolvedor Full Stack',
    'admin', -- Role admin = acesso a tudo (funcionário + gestor)
    company_id_val,
    'dept_1', -- Ajuste se necessário
    '{"notifications": true, "theme": "auto", "allowManualPunch": true, "language": "pt-BR"}'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    cargo = EXCLUDED.cargo,
    role = 'admin', -- Garante que seja admin
    company_id = EXCLUDED.company_id,
    department_id = EXCLUDED.department_id,
    preferences = EXCLUDED.preferences,
    updated_at = NOW();

  RAISE NOTICE 'Usuário Desenvolvedor criado/atualizado com sucesso!';
  RAISE NOTICE 'ID: %', auth_user_id;
  RAISE NOTICE 'Email: desenvolvedor@smartponto.com';
  RAISE NOTICE 'Senha: dev123';
  RAISE NOTICE 'Role: admin (acesso completo)';
END $$;

-- Verificar se foi criado corretamente
SELECT 
  id,
  nome,
  email,
  cargo,
  role,
  company_id,
  created_at
FROM users
WHERE email = 'desenvolvedor@smartponto.com';
