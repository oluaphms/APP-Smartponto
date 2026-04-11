# 🔍 DIAGNÓSTICO DE PERFORMANCE

## 🐌 Problemas Identificados

### 1️⃣ Queries Carregando Muitos Registros
```typescript
// ❌ PROBLEMA: Carregando 5000 registros de uma vez
db.select('time_records', [...], {...}, 5000)

// ✅ SOLUÇÃO: Limitar a 500-1000 registros
db.select('time_records', [...], {...}, 500)
```

### 2️⃣ Queries Sem Limite de Data
```typescript
// ❌ PROBLEMA: Carregando TODOS os registros da empresa
db.select('time_records', [{ column: 'company_id', operator: 'eq', value: user.companyId }])

// ✅ SOLUÇÃO: Adicionar filtro de data (últimos 30 dias)
db.select('time_records', [
  { column: 'company_id', operator: 'eq', value: user.companyId },
  { column: 'created_at', operator: 'gte', value: thirtyDaysAgo }
])
```

### 3️⃣ Múltiplas Queries em Paralelo
```typescript
// ❌ PROBLEMA: 5-10 queries em paralelo
const [users, records, departments, schedules, shifts] = await Promise.all([
  db.select('users', ...),
  db.select('time_records', ...),
  db.select('departments', ...),
  db.select('schedules', ...),
  db.select('work_shifts', ...),
])

// ✅ SOLUÇÃO: Carregar apenas o necessário, usar cache
```

### 4️⃣ Queries Sem Índices
```typescript
// ❌ PROBLEMA: Filtrar por coluna sem índice
db.select('time_records', [{ column: 'type', operator: 'eq', value: 'entrada' }])

// ✅ SOLUÇÃO: Usar colunas indexadas (company_id, created_at, user_id)
```

---

## 📊 Páginas Críticas

### 1. `admin/Timesheet.tsx` (Espelho de Ponto)
```
Problema: Carrega 2000 time_records + users + departments
Impacto: CRÍTICO - Demora muito
Solução: Limitar a 500 registros, adicionar filtro de data
```

### 2. `admin/Reports.tsx` (Relatórios)
```
Problema: Carrega 5000 time_records
Impacto: CRÍTICO - Muito lento
Solução: Limitar a 500, adicionar paginação
```

### 3. `admin/PontoDiario.tsx` (Ponto Diário)
```
Problema: Carrega 5000 time_records
Impacto: CRÍTICO - Muito lento
Solução: Limitar a 500, adicionar filtro de data
```

### 4. `admin/Monitoring.tsx` (Monitoramento)
```
Problema: Carrega users + time_records sem limite
Impacto: ALTO - Lento
Solução: Limitar registros, usar cache
```

---

## 🔧 Soluções Rápidas

### Solução 1: Reduzir Limite de Registros
```typescript
// ❌ ANTES
db.select('time_records', [...], {...}, 5000)

// ✅ DEPOIS
db.select('time_records', [...], {...}, 500)
```

### Solução 2: Adicionar Filtro de Data
```typescript
// ❌ ANTES
db.select('time_records', [{ column: 'company_id', operator: 'eq', value: user.companyId }])

// ✅ DEPOIS
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

db.select('time_records', [
  { column: 'company_id', operator: 'eq', value: user.companyId },
  { column: 'created_at', operator: 'gte', value: dateStr }
])
```

### Solução 3: Usar Cache
```typescript
// ✅ Usar queryCache para dados que não mudam frequentemente
const users = await queryCache.getOrFetch(
  `users:${user.companyId}`,
  () => db.select('users', [...]),
  TTL.NORMAL
);
```

### Solução 4: Lazy Loading
```typescript
// ✅ Carregar dados sob demanda
const [basicData, setBasicData] = useState(null);
const [detailedData, setDetailedData] = useState(null);

// Carregar básico primeiro
await loadBasicData();

// Carregar detalhes depois
await loadDetailedData();
```

---

## 📋 Páginas a Corrigir (Prioridade)

| Página | Problema | Prioridade | Solução |
|--------|----------|-----------|---------|
| `admin/Timesheet.tsx` | 2000 registros | 🔴 CRÍTICA | Limitar a 500 + filtro data |
| `admin/Reports.tsx` | 5000 registros | 🔴 CRÍTICA | Limitar a 500 + paginação |
| `admin/PontoDiario.tsx` | 5000 registros | 🔴 CRÍTICA | Limitar a 500 + filtro data |
| `admin/Monitoring.tsx` | Sem limite | 🟠 ALTA | Limitar + cache |
| `admin/Security.tsx` | Múltiplas queries | 🟠 ALTA | Otimizar queries |
| `admin/Schedules.tsx` | 5+ queries | 🟠 ALTA | Reduzir queries |
| `Employees.tsx` | Múltiplas queries | 🟠 ALTA | Otimizar |

---

## ✅ Checklist de Otimização

- [ ] Reduzir limite de registros (5000 → 500)
- [ ] Adicionar filtro de data (últimos 30 dias)
- [ ] Usar cache para dados estáticos
- [ ] Implementar paginação
- [ ] Reduzir número de queries paralelas
- [ ] Usar índices corretos
- [ ] Adicionar loading states
- [ ] Testar performance

---

## 🚀 Impacto Esperado

```
Antes:
- Timesheet: 10-15 segundos
- Reports: 15-20 segundos
- PontoDiario: 10-15 segundos

Depois:
- Timesheet: 1-2 segundos
- Reports: 2-3 segundos
- PontoDiario: 1-2 segundos

Melhoria: 80-90% mais rápido
```

---

**Versão:** 1.0  
**Data:** 2025-04-10  
**Status:** Diagnóstico Completo
