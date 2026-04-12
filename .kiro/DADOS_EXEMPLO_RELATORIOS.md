# Dados de Exemplo para Testes dos Relatórios

## 1. Relatório de Jornada

### Dados de Entrada
```typescript
const journeyData = [
  {
    employee: 'João Silva',
    date: '2026-04-11',
    scheduledHours: 480, // 8 horas
    workedHours: 480,
  },
  {
    employee: 'Maria Santos',
    date: '2026-04-11',
    scheduledHours: 480,
    workedHours: 420, // 7 horas (incompleta)
  },
  {
    employee: 'Pedro Costa',
    date: '2026-04-11',
    scheduledHours: 480,
    workedHours: 0, // Ausente
  },
  {
    employee: 'Ana Oliveira',
    date: '2026-04-11',
    scheduledHours: 480,
    workedHours: 540, // 9 horas (excedida)
  },
];
```

### Resultado Esperado
```
Resumo:
- Total de Dias: 4
- Dias Cumpridos: 1 (João)
- Dias Incompletos: 1 (Maria)
- Dias Excedidos: 1 (Ana)
- Dias Ausentes: 1 (Pedro)
- Taxa de Cumprimento: 25%

Tabela:
| Funcionário | Data | Jornada Prevista | Jornada Realizada | Status |
|-------------|------|------------------|-------------------|--------|
| João Silva | 11/04/2026 | 08:00 | 08:00 | Cumprida ✓ |
| Maria Santos | 11/04/2026 | 08:00 | 07:00 | Incompleta ⚠ |
| Pedro Costa | 11/04/2026 | 08:00 | 00:00 | Ausente ✗ |
| Ana Oliveira | 11/04/2026 | 08:00 | 09:00 | Excedida ℹ |
```

---

## 2. Relatório de Horas Extras

### Dados de Entrada
```typescript
const overtimeData = [
  {
    employee: 'João Silva',
    date: '2026-04-11',
    normalHours: 480,
    extraHours: 120, // 2 horas
    type: '100%' as const,
  },
  {
    employee: 'Maria Santos',
    date: '2026-04-11',
    normalHours: 480,
    extraHours: 60, // 1 hora
    type: '50%' as const,
  },
  {
    employee: 'Pedro Costa',
    date: '2026-04-11',
    normalHours: 480,
    extraHours: 90, // 1:30
    type: 'Banco de Horas' as const,
  },
  {
    employee: 'Ana Oliveira',
    date: '2026-04-11',
    normalHours: 480,
    extraHours: 0, // Sem extras
    type: '100%' as const,
  },
];
```

### Resultado Esperado
```
Resumo:
- Total de Horas Extras: 04:30
- Dias com Overtime: 3
- Horas 50%: 01:00
- Horas 100%: 02:00
- Banco de Horas: 01:30

Tabela:
| Funcionário | Data | Horas Normais | Horas Extras | Tipo |
|-------------|------|---------------|--------------|------|
| João Silva | 11/04/2026 | 08:00 | 02:00 | 100% |
| Maria Santos | 11/04/2026 | 08:00 | 01:00 | 50% |
| Pedro Costa | 11/04/2026 | 08:00 | 01:30 | Banco de Horas |
```

---

## 3. Relatório de Inconsistências

### Dados de Entrada
```typescript
const inconsistencyData = [
  {
    employee: 'João Silva',
    date: '2026-04-11',
    problem: 'Falta de batida' as const,
    severity: 'Crítica' as const,
    details: 'Nenhuma batida registrada',
  },
  {
    employee: 'Maria Santos',
    date: '2026-04-11',
    problem: 'Intervalo irregular' as const,
    severity: 'Média' as const,
    details: 'Intervalo muito curto: 12:00',
  },
  {
    employee: 'Pedro Costa',
    date: '2026-04-11',
    problem: 'Jornada incompleta' as const,
    severity: 'Média' as const,
    details: 'Falta registro de saída',
  },
  {
    employee: 'Ana Oliveira',
    date: '2026-04-11',
    problem: 'Batida duplicada' as const,
    severity: 'Leve' as const,
    details: 'Duas batidas no mesmo horário',
  },
];
```

### Resultado Esperado
```
Resumo:
- Total de Inconsistências: 4
- Funcionários Afetados: 4
- Problemas Críticos: 1
- Problemas Médios: 2
- Problemas Leves: 1

Tabela:
| Funcionário | Data | Problema | Severidade | Detalhes |
|-------------|------|----------|------------|----------|
| João Silva | 11/04/2026 | Falta de batida | Crítica | Nenhuma batida registrada |
| Maria Santos | 11/04/2026 | Intervalo irregular | Média | Intervalo muito curto: 12:00 |
| Pedro Costa | 11/04/2026 | Jornada incompleta | Média | Falta registro de saída |
| Ana Oliveira | 11/04/2026 | Batida duplicada | Leve | Duas batidas no mesmo horário |
```

---

## 4. Relatório de Banco de Horas

### Dados de Entrada
```typescript
const bankHoursData = [
  {
    employee: 'João Silva',
    previousBalance: 120, // +2:00
    credit: 60, // +1:00
    debit: 0,
  },
  {
    employee: 'Maria Santos',
    previousBalance: -180, // -3:00
    credit: 120, // +2:00
    debit: 60, // -1:00
  },
  {
    employee: 'Pedro Costa',
    previousBalance: 0,
    credit: 240, // +4:00
    debit: 120, // -2:00
  },
  {
    employee: 'Ana Oliveira',
    previousBalance: 300, // +5:00
    credit: 0,
    debit: 180, // -3:00
  },
];
```

### Resultado Esperado
```
Resumo:
- Total Positivo: 09:00
- Total Negativo: 04:00
- Funcionários com Saldo Positivo: 3
- Funcionários com Saldo Negativo: 1
- Saldo Líquido: +05:00

Tabela:
| Funcionário | Saldo Anterior | Crédito | Débito | Saldo Atual |
|-------------|----------------|---------|--------|------------|
| João Silva | +02:00 | +01:00 | -00:00 | +03:00 |
| Maria Santos | -03:00 | +02:00 | -01:00 | -02:00 |
| Pedro Costa | +00:00 | +04:00 | -02:00 | +02:00 |
| Ana Oliveira | +05:00 | +00:00 | -03:00 | +02:00 |
```

---

## 5. Relatório de Segurança (Antifraude)

### Dados de Entrada
```typescript
const securityData = [
  {
    employee: 'João Silva',
    date: '2026-04-11',
    eventType: 'Localização inconsistente' as const,
    riskLevel: 'Alto' as const,
    details: 'Batida em São Paulo, depois em Rio de Janeiro em 30 minutos',
  },
  {
    employee: 'Maria Santos',
    date: '2026-04-11',
    eventType: 'Troca de dispositivo' as const,
    riskLevel: 'Médio' as const,
    details: 'Dispositivo mudou de iPhone para Android',
  },
  {
    employee: 'Pedro Costa',
    date: '2026-04-11',
    eventType: 'Batida manual excessiva' as const,
    riskLevel: 'Baixo' as const,
    details: '5 batidas manuais em 1 dia',
  },
  {
    employee: 'Ana Oliveira',
    date: '2026-04-11',
    eventType: 'Falha de biometria' as const,
    riskLevel: 'Médio' as const,
    details: 'Falha ao processar impressão digital',
  },
  {
    employee: 'João Silva',
    date: '2026-04-12',
    eventType: 'Localização inconsistente' as const,
    riskLevel: 'Alto' as const,
    details: 'Batida em Brasília, depois em São Paulo em 20 minutos',
  },
];
```

### Resultado Esperado
```
Resumo:
- Eventos Suspeitos: 5
- Funcionários Afetados: 4
- Eventos de Alto Risco: 2
- Eventos de Médio Risco: 2
- Eventos de Baixo Risco: 1
- Top 5 Funcionários com Risco:
  1. João Silva (2 eventos)
  2. Maria Santos (1 evento)
  3. Pedro Costa (1 evento)
  4. Ana Oliveira (1 evento)

Tabela:
| Funcionário | Data | Tipo de Evento | Nível de Risco | Detalhes |
|-------------|------|----------------|----------------|----------|
| João Silva | 11/04/2026 | Localização inconsistente | Alto | Batida em SP, depois RJ em 30min |
| Maria Santos | 11/04/2026 | Troca de dispositivo | Médio | iPhone → Android |
| Pedro Costa | 11/04/2026 | Batida manual excessiva | Baixo | 5 batidas manuais em 1 dia |
| Ana Oliveira | 11/04/2026 | Falha de biometria | Médio | Falha ao processar impressão |
| João Silva | 12/04/2026 | Localização inconsistente | Alto | Batida em Brasília, depois SP em 20min |
```

---

## 6. Relatório de Horas Trabalhadas

### Dados de Entrada
```typescript
const workedHoursData = [
  {
    employee: 'João Silva',
    daysWorked: 20,
    totalHours: 9600, // 160 horas
    expectedHours: 9600,
  },
  {
    employee: 'Maria Santos',
    daysWorked: 18,
    totalHours: 8640, // 144 horas
    expectedHours: 9600,
  },
  {
    employee: 'Pedro Costa',
    daysWorked: 22,
    totalHours: 10560, // 176 horas
    expectedHours: 9600,
  },
  {
    employee: 'Ana Oliveira',
    daysWorked: 20,
    totalHours: 9600, // 160 horas
    expectedHours: 9600,
  },
];
```

### Resultado Esperado
```
Resumo:
- Total Geral de Horas: 640:00
- Média por Funcionário: 160:00
- Total de Funcionários: 4
- Total de Dias Trabalhados: 80
- Média por Dia: 08:00

Tabela:
| Funcionário | Dias Trabalhados | Total de Horas | Média Diária | Percentual |
|-------------|------------------|----------------|--------------|-----------|
| João Silva | 20 | 160:00 | 08:00 | 100.0% |
| Maria Santos | 18 | 144:00 | 08:00 | 90.0% |
| Pedro Costa | 22 | 176:00 | 08:00 | 110.0% |
| Ana Oliveira | 20 | 160:00 | 08:00 | 100.0% |
```

---

## Como Usar os Dados de Exemplo

### 1. Copiar dados para o componente
```typescript
const mockData = journeyData; // Usar dados de exemplo
const report = generateJourneyReport(mockData, filter, 'Empresa Exemplo');
setReport(report);
```

### 2. Testar exportação
```typescript
// PDF
await exportReportToPDF(report, 'journey');

// Excel
await exportReportToExcel(report, 'journey');
```

### 3. Validar cálculos
- Verificar se resumo está correto
- Verificar se tabela está formatada
- Verificar cores dos badges
- Verificar ordenação

---

## Dados Reais (Quando Conectar com Supabase)

### Query para Jornada
```sql
SELECT
  e.name as employee,
  tr.date,
  es.scheduled_minutes,
  tr.worked_minutes
FROM time_records tr
JOIN employees e ON tr.employee_id = e.id
JOIN employee_shift_schedule es ON e.id = es.employee_id
WHERE tr.date BETWEEN $1 AND $2
ORDER BY tr.date, e.name;
```

### Query para Horas Extras
```sql
SELECT
  e.name as employee,
  tr.date,
  es.scheduled_minutes as normal_hours,
  CASE
    WHEN tr.worked_minutes > es.scheduled_minutes THEN tr.worked_minutes - es.scheduled_minutes
    ELSE 0
  END as extra_hours,
  CASE
    WHEN tr.overtime_type = 'bank' THEN 'Banco de Horas'
    WHEN tr.overtime_type = 'fifty' THEN '50%'
    ELSE '100%'
  END as type
FROM time_records tr
JOIN employees e ON tr.employee_id = e.id
JOIN employee_shift_schedule es ON e.id = es.employee_id
WHERE tr.date BETWEEN $1 AND $2
  AND tr.worked_minutes > es.scheduled_minutes
ORDER BY tr.date, e.name;
```

---

## Validação de Dados

Checklist para validar dados de exemplo:

- [ ] Todos os campos preenchidos
- [ ] Datas no formato correto (YYYY-MM-DD)
- [ ] Horas em minutos (480 = 8 horas)
- [ ] Nomes de funcionários consistentes
- [ ] Valores de resumo calculados corretamente
- [ ] Cores dos badges aplicadas corretamente
- [ ] Tabela ordenável
- [ ] Exportação PDF funciona
- [ ] Exportação Excel funciona
