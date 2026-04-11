# 🔧 SQL PARA EXECUTAR NO SUPABASE

## ⚡ Instruções Rápidas

1. Abrir: https://app.supabase.com
2. Selecionar projeto: **ChronoDigital**
3. Ir para: **SQL Editor** → **New query**
4. **Copiar TODO o SQL abaixo**
5. **Colar no editor**
6. **Clicar: Run**
7. **Aguardar: "Success. No rows returned"**

---

## 📋 SQL COMPLETO

```sql
-- ============================================================
-- Migration: Fluxo completo de Ajuste de Ponto
-- Execute no Supabase: SQL Editor → New query → Run
-- ============================================================

-- 1) Colunas adicionais em time_adjustments para o fluxo completo
-- Nota: company_id já existe, então não adicionamos novamente
ALTER TABLE public.time_adjustments
  ADD COLUMN IF NOT EXISTS adjustment_type TEXT DEFAULT 'entrada'
    CHECK (adjustment_type IN ('entrada', 'saida', 'ambos'));

ALTER TABLE public.time_adjustments
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.time_adjustments
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.time_adjustments
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2) Índices para a listagem do admin
CREATE INDEX IF NOT EXISTS idx_time_adjustments_status
  ON public.time_adjustments(status);

CREATE INDEX IF NOT EXISTS idx_time_adjustments_created
  ON public.time_adjustments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_adjustments_user_status
  ON public.time_adjustments(user_id, status);

-- 3) Habilitar RLS em time_adjustments (se ainda não estiver habilitado)
ALTER TABLE public.time_adjustments ENABLE ROW LEVEL SECURITY;

-- 4) RLS: Colaborador pode ver próprias solicitações
DROP POLICY IF EXISTS "Users can view own adjustments" ON public.time_adjustments;
CREATE POLICY "Users can view own adjustments" ON public.time_adjustments
  FOR SELECT TO authenticated
  USING (auth.uid()::text = user_id::text);

-- 5) RLS: Colaborador pode criar próprias solicitações
DROP POLICY IF EXISTS "Users can create own adjustments" ON public.time_adjustments;
CREATE POLICY "Users can create own adjustments" ON public.time_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

-- 6) RLS: Admin/HR pode ver todas as solicitações
DROP POLICY IF EXISTS "Admin can view company adjustments" ON public.time_adjustments;
CREATE POLICY "Admin can view company adjustments" ON public.time_adjustments
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'hr')
  );

-- 7) RLS: Admin/HR pode atualizar solicitações
DROP POLICY IF EXISTS "Admin can update company adjustments" ON public.time_adjustments;
CREATE POLICY "Admin can update company adjustments" ON public.time_adjustments
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'hr')
  );

-- 8) RLS: Admin/HR pode atualizar time_records ao aplicar ajuste aprovado
DROP POLICY IF EXISTS "Admin can update company records" ON public.time_records;
CREATE POLICY "Admin can update company records" ON public.time_records
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'hr')
  );

-- 9) Tabela de histórico de mudanças em ajustes
CREATE TABLE IF NOT EXISTS public.time_adjustments_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES public.time_adjustments(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  details JSONB,
  company_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para histórico
CREATE INDEX IF NOT EXISTS idx_time_adjustments_history_adjustment_id
  ON public.time_adjustments_history(adjustment_id);

CREATE INDEX IF NOT EXISTS idx_time_adjustments_history_changed_at
  ON public.time_adjustments_history(changed_at DESC);

-- RLS para histórico
ALTER TABLE public.time_adjustments_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own adjustment history" ON public.time_adjustments_history;
CREATE POLICY "Users can view own adjustment history" ON public.time_adjustments_history
  FOR SELECT TO authenticated
  USING (
    adjustment_id IN (
      SELECT id FROM public.time_adjustments 
      WHERE auth.uid()::text = user_id::text
    )
  );

DROP POLICY IF EXISTS "Admin can view company adjustment history" ON public.time_adjustments_history;
CREATE POLICY "Admin can view company adjustment history" ON public.time_adjustments_history
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'hr')
  );

-- 10) Função para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION public.log_adjustment_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.time_adjustments_history (
    adjustment_id,
    old_status,
    new_status,
    changed_by,
    company_id,
    details
  ) VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    auth.uid(),
    NEW.company_id,
    jsonb_build_object(
      'old_reviewed_by', OLD.reviewed_by,
      'new_reviewed_by', NEW.reviewed_by,
      'old_rejection_reason', OLD.rejection_reason,
      'new_rejection_reason', NEW.rejection_reason,
      'old_original_time', OLD.original_time,
      'new_original_time', NEW.original_time
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para registrar mudanças
DROP TRIGGER IF EXISTS trigger_log_adjustment_change ON public.time_adjustments;
CREATE TRIGGER trigger_log_adjustment_change
  AFTER UPDATE ON public.time_adjustments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_adjustment_change();
```

---

## ✅ Resultado Esperado

Após executar, você deve ver:

```
Success. No rows returned
```

---

## 🔍 Validação Pós-Execução

Execute estas queries para validar:

### 1. Verificar Tabelas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('time_adjustments', 'time_adjustments_history')
ORDER BY table_name;
```

**Resultado esperado:**
```
time_adjustments
time_adjustments_history
```

### 2. Verificar Colunas Novas
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_adjustments'
AND column_name IN ('adjustment_type', 'reviewed_by', 'reviewed_at', 'rejection_reason')
ORDER BY column_name;
```

**Resultado esperado:**
```
adjustment_type      | text
rejection_reason     | text
reviewed_at          | timestamp with time zone
reviewed_by          | uuid
```

### 3. Verificar Políticas RLS
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'time_adjustments'
ORDER BY policyname;
```

**Resultado esperado:**
```
Admin can update company adjustments | UPDATE
Admin can view company adjustments   | SELECT
Users can create own adjustments     | INSERT
Users can view own adjustments       | SELECT
```

### 4. Verificar Função
```sql
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'log_adjustment_change';
```

**Resultado esperado:**
```
log_adjustment_change | t
```

### 5. Verificar Trigger
```sql
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_log_adjustment_change';
```

**Resultado esperado:**
```
trigger_log_adjustment_change | UPDATE
```

---

## ⚠️ Se Tiver Erro

### Erro: "column already exists"
```
✅ Solução: Usar IF NOT EXISTS (já está no código)
```

### Erro: "syntax error"
```
✅ Solução: Verificar se copiou exatamente como está
```

### Erro: "permission denied"
```
✅ Solução: Verificar se usuário tem permissões de admin no Supabase
```

### Erro: "function already exists"
```
✅ Solução: Usar CREATE OR REPLACE (já está no código)
```

---

## 📝 Próximos Passos

Após executar com sucesso:

1. Compilar TypeScript:
   ```bash
   npm run build
   ```

2. Testar localmente:
   ```bash
   npm run dev
   ```

3. Validar fluxo completo (ver guia rápido)

4. Deploy:
   ```bash
   git add .
   git commit -m "feat: Implementar fluxo de ajuste de ponto"
   git push
   ```

---

**Status:** ✅ Pronto para executar  
**Tempo:** ~1 minuto  
**Dificuldade:** Baixa
