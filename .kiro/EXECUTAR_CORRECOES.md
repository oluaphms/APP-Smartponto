# 🚀 GUIA DE EXECUÇÃO DAS CORREÇÕES

## ⚠️ IMPORTANTE
Siga os passos na ordem exata. Não pule nenhum passo.

---

## PASSO 1: Executar Migration no Supabase

### 1.1 Abrir Supabase
- Ir para https://app.supabase.com
- Selecionar o projeto ChronoDigital
- Clicar em "SQL Editor"

### 1.2 Criar Nova Query
- Clicar em "New query"
- Copiar TODO o conteúdo de:
  ```
  supabase/migrations/20250410000000_adjustment_flow.sql
  ```

### 1.3 Executar
- Colar o SQL no editor
- Clicar em "Run"
- Aguardar conclusão

### 1.4 Verificar Resultado
Você deve ver:
```
✓ Success. No rows returned
```

Se receber erro, verificar:
- [ ] Tabela `time_adjustments` existe?
- [ ] Tabela `time_records` existe?
- [ ] Tabela `users` existe?
- [ ] RLS está habilitado?

---

## PASSO 2: Verificar Políticas RLS

### 2.1 No Supabase, ir para "Authentication" → "Policies"

### 2.2 Verificar se existem as políticas:
- [ ] `Users can view own adjustments`
- [ ] `Users can create own adjustments`
- [ ] `Admin can view company adjustments`
- [ ] `Admin can update company adjustments`
- [ ] `Admin can update company records`

### 2.3 Se alguma estiver faltando, executar novamente a migration

---

## PASSO 3: Verificar Tabela de Histórico

### 3.1 No Supabase, ir para "Table Editor"

### 3.2 Procurar por `time_adjustments_history`

### 3.3 Verificar se tem as colunas:
- [ ] `id` (UUID)
- [ ] `adjustment_id` (UUID)
- [ ] `old_status` (TEXT)
- [ ] `new_status` (TEXT)
- [ ] `changed_by` (UUID)
- [ ] `changed_at` (TIMESTAMPTZ)
- [ ] `reason` (TEXT)
- [ ] `details` (JSONB)
- [ ] `company_id` (TEXT)

---

## PASSO 4: Atualizar Código TypeScript

### 4.1 Verificar se os arquivos foram criados:
```bash
ls -la src/services/adjustmentHistoryService.ts
ls -la src/components/AdjustmentHistoryModal.tsx
```

### 4.2 Se não existirem, criar manualmente:
- Copiar conteúdo de `src/services/adjustmentHistoryService.ts`
- Copiar conteúdo de `src/components/AdjustmentHistoryModal.tsx`

### 4.3 Verificar se `src/pages/Adjustments.tsx` foi atualizado:
- Procurar por `import { AdjustmentHistoryModal }`
- Procurar por `<History className="w-4 h-4" />`
- Procurar por `historyTarget`

---

## PASSO 5: Compilar e Testar

### 5.1 Instalar dependências (se necessário)
```bash
npm install
```

### 5.2 Compilar TypeScript
```bash
npm run build
```

### 5.3 Verificar erros
Se houver erros de tipo, corrigir:
- Verificar imports
- Verificar tipos de dados
- Verificar nomes de funções

### 5.4 Iniciar servidor de desenvolvimento
```bash
npm run dev
```

---

## PASSO 6: Testar Fluxo Completo

### 6.1 Fazer Login como Colaborador
- Ir para `/adjustments`
- Clicar em "Solicitar ajuste"
- Preencher formulário
- Clicar em "Enviar solicitação"

### 6.2 Fazer Login como Admin
- Ir para `/admin/adjustments`
- Verificar se a solicitação aparece
- Clicar no ícone de histórico (History)
- Verificar se mostra "Pendente"

### 6.3 Aprovar Solicitação
- Clicar no botão de aprovação (CheckCircle2)
- Aguardar confirmação
- Clicar no ícone de histórico novamente
- Verificar se mostra "Pendente → Aprovado"

### 6.4 Rejeitar Solicitação (Teste 2)
- Criar nova solicitação como colaborador
- Como admin, clicar no botão de rejeição (XCircle)
- Preencher motivo
- Clicar em "Confirmar rejeição"
- Clicar no ícone de histórico
- Verificar se mostra "Pendente → Rejeitado" com motivo

---

## PASSO 7: Verificar Segurança (RLS)

### 7.1 Teste de Isolamento de Dados
- Colaborador A cria solicitação
- Colaborador B tenta acessar `/adjustments`
- Verificar se Colaborador B NÃO vê solicitação de A

### 7.2 Teste de Permissões
- Colaborador tenta atualizar status de solicitação (via DevTools)
- Verificar se recebe erro de permissão

### 7.3 Teste de Admin
- Admin vê todas as solicitações da empresa
- Admin consegue aprovar/rejeitar
- Admin vê histórico completo

---

## PASSO 8: Verificar Logs

### 8.1 No Supabase, ir para "Logs"

### 8.2 Procurar por:
- `ADMIN_APPROVE_ADJUSTMENT`
- `ADMIN_REJECT_ADJUSTMENT`
- `USER_REQUEST_ADJUSTMENT`

### 8.3 Verificar se contêm:
- [ ] ID da solicitação
- [ ] ID do colaborador
- [ ] ID do admin
- [ ] Data/hora
- [ ] Detalhes da ação

---

## PASSO 9: Verificar Histórico no Banco

### 9.1 No Supabase SQL Editor, executar:
```sql
SELECT * FROM public.time_adjustments_history 
ORDER BY changed_at DESC 
LIMIT 10;
```

### 9.2 Verificar se mostra:
- [ ] Mudanças de status
- [ ] Quem fez cada mudança
- [ ] Data/hora exata
- [ ] Motivo (se rejeitado)
- [ ] Detalhes técnicos (JSON)

---

## ✅ Checklist Final

- [ ] Migration executada com sucesso
- [ ] Políticas RLS criadas
- [ ] Tabela de histórico existe
- [ ] Arquivos TypeScript criados
- [ ] Página de Adjustments atualizada
- [ ] Código compila sem erros
- [ ] Colaborador consegue solicitar
- [ ] Admin consegue aprovar/rejeitar
- [ ] Histórico mostra transições
- [ ] RLS funciona (isolamento de dados)
- [ ] Logs registram ações
- [ ] Banco de dados tem histórico

---

## 🆘 Troubleshooting

### Erro: "operator does not exist: text = uuid"
**Solução:** Executar migration novamente - ela corrige o tipo

### Erro: "permission denied for schema public"
**Solução:** Verificar se usuário Supabase tem permissões de admin

### Histórico não aparece
**Solução:** 
1. Verificar se tabela `time_adjustments_history` existe
2. Verificar se trigger está ativo
3. Executar: `SELECT * FROM time_adjustments_history;`

### RLS bloqueando tudo
**Solução:**
1. Verificar se políticas estão corretas
2. Verificar se `company_id` está preenchido
3. Verificar se `role` está correto (admin/hr)

### Componente não renderiza
**Solução:**
1. Verificar imports
2. Verificar se `AdjustmentHistoryModal` está importado
3. Verificar console do navegador para erros

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar console do navegador (F12)
2. Verificar logs do Supabase
3. Executar migration novamente
4. Limpar cache do navegador (Ctrl+Shift+Delete)
5. Reiniciar servidor de desenvolvimento

