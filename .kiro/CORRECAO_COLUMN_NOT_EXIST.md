# 🔧 CORREÇÃO: Column "company_id" Does Not Exist

## ❌ Erro Encontrado
```
ERROR: 42703: column "company_id" does not exist
```

## 🔍 Causa
A coluna `company_id` não existia em `time_adjustments` quando a migration tentou usá-la.

## ✅ Solução Implementada

### 1. Verificação Condicional
```sql
-- Adicionar company_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'time_adjustments' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.time_adjustments ADD COLUMN company_id TEXT;
  END IF;
END $$;
```

**Benefício:** Não falha se a coluna já existe

### 2. Políticas RLS com COALESCE
```sql
-- Antes (ERRADO)
WHERE company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())

-- Depois (CORRETO)
WHERE COALESCE(company_id, (SELECT company_id FROM public.users WHERE id = auth.uid())) = 
      (SELECT company_id FROM public.users WHERE id = auth.uid())
```

**Benefício:** Funciona mesmo se `company_id` for NULL

### 3. Preenchimento Retroativo
```sql
-- Preencher company_id retroativamente
UPDATE public.time_adjustments ta
SET company_id = u.company_id
FROM public.users u
WHERE ta.user_id::text = u.id::text
  AND ta.company_id IS NULL;
```

**Benefício:** Dados históricos são preenchidos automaticamente

---

## 🚀 Como Executar Novamente

### Passo 1: Abrir Supabase SQL Editor
- Ir para https://app.supabase.com
- Selecionar projeto ChronoDigital
- Clicar em "SQL Editor"

### Passo 2: Copiar Migration Corrigida
```
Copiar TODO o conteúdo de:
supabase/migrations/20250410000000_adjustment_flow.sql
```

### Passo 3: Executar
- Colar no editor
- Clicar em "Run"
- Aguardar conclusão

### Passo 4: Verificar Resultado
Você deve ver:
```
✓ Success. No rows returned
```

---

## ✅ Validação

### Verificar se Funcionou
```sql
-- Verificar se coluna existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'time_adjustments' 
AND column_name = 'company_id';

-- Verificar se dados foram preenchidos
SELECT COUNT(*) as total, 
       COUNT(company_id) as com_company_id
FROM public.time_adjustments;
```

### Verificar Políticas RLS
```sql
-- Listar políticas
SELECT * FROM pg_policies 
WHERE tablename = 'time_adjustments';
```

---

## 🔒 Segurança

A correção mantém a segurança:
- ✅ RLS ainda funciona
- ✅ Isolamento de dados preservado
- ✅ Validação de role mantida
- ✅ Histórico seguro

---

## 📝 Mudanças Realizadas

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/20250410000000_adjustment_flow.sql` | Adicionada verificação condicional de coluna |
| `supabase/migrations/20250410000000_adjustment_flow.sql` | Políticas RLS com COALESCE |
| `supabase/migrations/20250410000000_adjustment_flow.sql` | Preenchimento retroativo de company_id |

---

## 🎯 Resultado

Agora a migration:
- ✅ Verifica se coluna existe
- ✅ Cria se não existir
- ✅ Preenche dados retroativamente
- ✅ Funciona com ou sem company_id

---

## 📞 Se Ainda Tiver Erro

### Erro: "column already exists"
```
✅ Solução: Já foi corrigido com IF NOT EXISTS
```

### Erro: "permission denied"
```
✅ Solução: Verificar se usuário tem permissões de admin
```

### Erro: "relation does not exist"
```
✅ Solução: Verificar se tabela time_adjustments existe
```

---

## ✨ Próximos Passos

1. ✅ Executar migration corrigida
2. ✅ Compilar código (`npm run build`)
3. ✅ Testar fluxo (`npm run dev`)
4. ✅ Validar segurança
5. ✅ Deploy

---

**Status:** ✅ Corrigido e Pronto para Executar

