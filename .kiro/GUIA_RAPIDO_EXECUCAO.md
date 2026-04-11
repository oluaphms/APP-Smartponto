# ⚡ GUIA RÁPIDO - EXECUTAR AGORA

## 🎯 Objetivo
Executar a migration corrigida e validar o fluxo de ajuste de ponto.

---

## 📋 Checklist Rápido (5 minutos)

### ✅ PASSO 1: Executar Migration (1 min)
```
1. Abrir: https://app.supabase.com
2. Projeto: ChronoDigital
3. SQL Editor → New query
4. Copiar: supabase/migrations/20250410000000_adjustment_flow.sql
5. Colar no editor
6. Clicar: Run
7. Resultado: "Success. No rows returned" ✓
```

### ✅ PASSO 2: Compilar (1 min)
```bash
npm run build
```
**Esperado:** Sem erros ✓

### ✅ PASSO 3: Testar (3 min)
```bash
npm run dev
```

**Testar como COLABORADOR:**
1. Ir para: Ponto → Ajustes de Ponto
2. Clicar: "Solicitar ajuste"
3. Preencher: Data, Horário, Tipo, Motivo
4. Clicar: "Enviar solicitação" ✓

**Testar como ADMIN:**
1. Ir para: Ponto → Ajustes de Ponto
2. Ver: Solicitação do colaborador
3. Clicar: ✓ (aprovar) ✓

**Validar:**
- [ ] Solicitação criada
- [ ] Admin vê solicitação
- [ ] Admin consegue aprovar
- [ ] Histórico mostra mudança
- [ ] Colaborador recebeu notificação

---

## 🔍 Validação Rápida (Supabase)

### Verificar Tabelas
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('time_adjustments', 'time_adjustments_history');
```

### Verificar Colunas Novas
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'time_adjustments' 
AND column_name IN ('adjustment_type', 'reviewed_by', 'reviewed_at', 'rejection_reason');
```

### Verificar Políticas
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'time_adjustments';
```

---

## 📁 Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20250410000000_adjustment_flow.sql` | Migration SQL |
| `src/services/adjustmentFlowService.ts` | Lógica de aprovação/rejeição |
| `src/components/AdjustmentHistoryModal.tsx` | Componente de histórico |
| `src/pages/Adjustments.tsx` | Página principal |

---

## ⚠️ Possíveis Erros

| Erro | Solução |
|------|---------|
| "column already exists" | Usar IF NOT EXISTS (já está) |
| "syntax error" | Copiar exatamente como está |
| "permission denied" | Verificar permissões no Supabase |
| "RLS policy violation" | Verificar role do usuário (admin/hr) |

---

## ✅ Sucesso!

Se tudo funcionou:
```bash
git add .
git commit -m "feat: Implementar fluxo de ajuste de ponto"
git push
```

---

**Tempo total:** ~5 minutos  
**Dificuldade:** Baixa  
**Status:** ✅ Pronto para executar
