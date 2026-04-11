# Notificações Sincronizadas com Solicitações

## Problema
Notificações não estavam sincronizadas com solicitações. Quando o admin aprovava/rejeitava uma solicitação, a notificação não era deletada.

## Solução Implementada

### Estratégia: Sincronizar notificações com status de solicitações

Agora quando um admin aprova ou rejeita uma solicitação:
1. Notificação do admin é deletada
2. Notificação do colaborador é deletada
3. Nova notificação é criada para o colaborador com o resultado

### Código Atualizado

**src/pages/Requests.tsx - handleStatusChange():**

```typescript
const handleStatusChange = async (row: RequestRow, status: 'approved' | 'rejected') => {
  if (!user || !isSupabaseConfigured) return;

  try {
    // 1. Atualizar status da solicitação
    await db.update('requests', row.id, { status });

    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, status } : r)),
    );

    // 2. Deletar notificação da solicitação para o admin/RH
    try {
      const allNotifications = await NotificationService.getAll(user.id, true);
      const requestNotifications = allNotifications.filter(
        (n) => n.metadata?.requestId === row.id
      );
      
      for (const notif of requestNotifications) {
        await NotificationService.markAsRead(user.id, notif.id);
      }
    } catch (e) {
      console.error('Erro ao deletar notificação do admin:', e);
    }

    // 3. Deletar notificações pendentes do colaborador
    await NotificationService.resolveByReference(row.user_id, row.id, 'request');

    // 4. Criar nova notificação para o colaborador com o resultado
    await NotificationService.create({
      userId: row.user_id,
      type: status === 'approved' ? 'success' : 'warning',
      title: 'Solicitação atualizada',
      message:
        status === 'approved'
          ? 'Sua solicitação foi aprovada.'
          : 'Sua solicitação foi rejeitada.',
      metadata: { requestId: row.id },
    });

    // 5. Registrar ação no log
    await LoggingService.log({
      severity: LogSeverity.INFO,
      action: 'ADMIN_UPDATE_REQUEST',
      userId: user.id,
      userName: user.nome,
      companyId: user.companyId,
      details: { requestId: row.id, status },
    });
  } catch (err) {
    console.error('Erro ao atualizar solicitação:', err);
  }
};
```

## Fluxo de Funcionamento

### Quando Colaborador Cria Solicitação:
```
Colaborador cria solicitação
    ↓
1. Notificação para colaborador: "Solicitação enviada"
2. Notificação para admin/RH: "Nova solicitação"
    ↓
Admin vê notificação no sino
```

### Quando Admin Aprova/Rejeita:
```
Admin clica "Aprovar" ou "Rejeitar"
    ↓
1. Status da solicitação atualizado
2. Notificação do admin deletada
3. Notificações antigas do colaborador deletadas
4. Nova notificação para colaborador: "Solicitação aprovada/rejeitada"
    ↓
Colaborador vê nova notificação no sino
```

## Sincronização de Notificações

### Notificação do Admin:
- **Criada:** Quando colaborador cria solicitação
- **Deletada:** Quando admin aprova/rejeita
- **Metadados:** `{ requestId: id }`

### Notificação do Colaborador (Pendente):
- **Criada:** Quando colaborador cria solicitação
- **Deletada:** Quando admin aprova/rejeita
- **Metadados:** `{ requestId: id }`

### Notificação do Colaborador (Resultado):
- **Criada:** Quando admin aprova/rejeita
- **Tipo:** "success" (aprovada) ou "warning" (rejeitada)
- **Metadados:** `{ requestId: id }`

## Teste

### Cenário 1: Criar Solicitação
1. **Fazer login como colaborador**
2. **Ir para Solicitações**
3. **Clicar em "Nova solicitação"**
4. **Preencher e enviar**
5. **Verificar notificação do colaborador:** "Solicitação enviada"
6. **Fazer login como admin**
7. **Verificar notificação do admin:** "Nova solicitação"

### Cenário 2: Aprovar Solicitação
1. **Admin clica "Aprovar"**
2. **Notificação do admin desaparece**
3. **Fazer login como colaborador**
4. **Verificar notificação:** "Solicitação aprovada"

### Cenário 3: Rejeitar Solicitação
1. **Admin clica "Rejeitar"**
2. **Notificação do admin desaparece**
3. **Fazer login como colaborador**
4. **Verificar notificação:** "Solicitação rejeitada"

## Comportamento Esperado

### Colaborador:
- ✅ Recebe notificação "Solicitação enviada" ao criar
- ✅ Notificação desaparece quando admin processa
- ✅ Recebe notificação "Solicitação aprovada/rejeitada"
- ✅ Pode deletar notificações clicando X

### Admin/RH:
- ✅ Recebe notificação "Nova solicitação"
- ✅ Notificação desaparece ao aprovar/rejeitar
- ✅ Pode deletar notificação clicando X
- ✅ Pode clicar no link para ir para Solicitações

## Vantagens

✅ **Sincronizado** - Notificações refletem status das solicitações
✅ **Limpo** - Notificações antigas são deletadas
✅ **Informativo** - Colaborador sabe o resultado
✅ **Sem duplicatas** - Apenas uma notificação por solicitação
✅ **Rastreável** - Metadados vinculam notificação à solicitação

## Resumo

Agora as notificações estão sincronizadas com as solicitações:
1. Colaborador cria → Ambos recebem notificação
2. Admin processa → Notificações antigas deletadas
3. Colaborador notificado → Resultado da solicitação
4. Tudo sincronizado → Sem notificações órfãs
