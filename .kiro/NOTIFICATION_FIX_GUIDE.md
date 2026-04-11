# Guia de Correção de Notificações

## Problema
Usuários não conseguem excluir notificações porque a tabela `notifications` está faltando as colunas `status` e `updated_at`.

## Solução

### Passo 1: Executar a Migração no Supabase

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor** → **New query**
4. Copie e cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260411000005_add_status_and_updated_at_to_notifications.sql
   ```
5. Clique em **Run**

### Passo 2: Verificar se a Migração Foi Aplicada

Execute esta query no SQL Editor para verificar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;
```

Você deve ver as colunas:
- `status` (TEXT)
- `updated_at` (TIMESTAMPTZ)

### Passo 3: Testar a Funcionalidade

1. Recarregue a aplicação
2. Clique no sino de notificações no canto superior direito
3. Clique no botão **X** em qualquer notificação
4. A notificação deve desaparecer

## O que foi Corrigido

### Backend (notificationService.ts)
- ✅ Adicionado fallback para atualizar apenas o campo `read` se as colunas novas não existirem
- ✅ Melhor tratamento de erros com try-catch aninhado
- ✅ Continua funcionando com localStorage como backup

### Frontend (NotificationCenter.tsx)
- ✅ Adicionado botão X para excluir notificações
- ✅ Melhor tratamento de erros ao deletar
- ✅ Feedback visual ao clicar no botão de exclusão

### Database (Migration)
- ✅ Adicionada coluna `status` (pending, read, resolved)
- ✅ Adicionada coluna `updated_at` para rastreamento
- ✅ Criado índice para queries de status
- ✅ Atualização automática de registros existentes

## Comportamento Esperado

Após a migração:
- Notificações podem ser marcadas como lidas (✓ botão)
- Notificações podem ser excluídas (X botão)
- Notificações excluídas desaparecem da lista
- Funciona em modo claro e escuro
- Fallback para localStorage se Supabase falhar

## Troubleshooting

### Erro: "Could not find the 'updated_at' column"
- A migração ainda não foi executada
- Execute a migração conforme descrito no Passo 1

### Notificações não desaparecem após clicar X
- Verifique se a migração foi executada com sucesso
- Verifique o console do navegador para erros
- Tente recarregar a página

### Erro de permissão ao atualizar
- Verifique as RLS policies da tabela `notifications`
- Certifique-se de que o usuário autenticado tem permissão UPDATE

## Rollback (se necessário)

Se precisar reverter a migração:

```sql
ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS updated_at;

DROP INDEX IF EXISTS idx_notifications_status;
```
