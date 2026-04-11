# ✅ CORREÇÃO: Erro ao Remover Ausências

## 🐛 Problema Identificado

### Erro:
```
Failed to load resource: the server responded with a status of 400 ()
aigegesxwrmgktmkbers.supabase.co/rest/v1/absences?id=eq.%5Bobject+Object%5D
Erro ao deletar ausência: ObjectT
```

### Causa:
O método `db.delete()` estava recebendo um array de filtros em vez de apenas o `id`:

```typescript
// ❌ ANTES (incorreto)
await db.delete('absences', [{ column: 'id', operator: 'eq', value: id }]);
// Resultado: id=eq.[object Object]
```

---

## ✅ Solução Implementada

### Correção:
```typescript
// ✅ DEPOIS (correto)
await db.delete('absences', id);
// Resultado: Deleta corretamente
```

### Padrão Correto:
O `db.delete()` recebe apenas 2 parâmetros:
1. **table**: Nome da tabela (string)
2. **id**: ID do registro a deletar (string)

```typescript
// Exemplos corretos de uso:
await db.delete('absences', id);
await db.delete('departments', id);
await db.delete('users', id);
await db.delete('requests', row.id);
```

---

## 📝 Arquivo Modificado

**Arquivo:** `src/pages/Absences.tsx`

### Função `handleDelete()`:
```typescript
const handleDelete = async (id: string) => {
  if (!user || !isSupabaseConfigured) return;
  setDeletingId(id);
  try {
    // ✅ Correto: apenas id
    await db.delete('absences', id);
    
    // Remover da lista local
    setRows((prev) => prev.filter((r) => r.id !== id));
    
    // Registrar auditoria
    await LoggingService.log({
      severity: LogSeverity.INFO,
      action: 'DELETE_ABSENCE',
      userId: user.id,
      userName: user.nome,
      companyId: user.companyId,
      details: { absenceId: id },
    });

    toast.addToast('success', 'Ausência removida com sucesso.');
  } catch (err) {
    console.error('Erro ao deletar ausência:', err);
    toast.addToast('error', 'Erro ao remover ausência.');
  } finally {
    setDeletingId(null);
  }
};
```

---

## ✅ Compilação

### Status: ✅ SUCESSO

```
npm run build
✓ 4425 modules transformed
✓ Rendering chunks
✓ Computing gzip size
✓ Built in 35.56s
```

---

## 🧪 Teste

### Como Testar:
1. Abrir a página de Ausências
2. Criar uma ausência
3. Clicar no ícone de lixeira (Trash2)
4. Ausência deve ser deletada
5. Toast de sucesso deve aparecer
6. Lista deve ser atualizada

### Resultado Esperado:
```
✅ Ausência removida com sucesso.
```

---

## 📊 Comparação

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Parâmetro | Array de filtros | ID simples |
| Erro | 400 Bad Request | ✅ Sucesso |
| URL | `id=eq.[object Object]` | Correto |
| Funcionamento | ❌ Não funciona | ✅ Funciona |

---

## 🔍 Validação

### Diagnostics:
```
src/pages/Absences.tsx: No diagnostics found ✅
```

### Build:
```
npm run build: SUCCESS ✅
```

---

## ✨ Status Final

```
✅ ERRO IDENTIFICADO
✅ SOLUÇÃO IMPLEMENTADA
✅ COMPILAÇÃO BEM-SUCEDIDA
✅ PRONTO PARA TESTAR
```

---

**Versão:** 1.0  
**Data:** 2025-04-10  
**Status:** ✅ Corrigido e Pronto para Testar
