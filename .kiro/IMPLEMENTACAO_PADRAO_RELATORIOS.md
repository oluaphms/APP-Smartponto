# IMPLEMENTAÇÃO DO PADRÃO DE RELATÓRIOS

## 📋 O QUE FOI CRIADO

### 1. Componente Base: ReportLayout
**Arquivo**: `src/components/Reports/ReportLayout.tsx`

Componente reutilizável que fornece:
- ✅ Cabeçalho com título e empresa
- ✅ Seção de filtros aplicados
- ✅ Cards de resumo
- ✅ Tabela principal formatada
- ✅ Rodapé com data/hora de geração

**Uso**:
```typescript
import ReportLayout from '@/components/Reports/ReportLayout';

<ReportLayout
  title="Espelho de Ponto"
  company="Empresa XYZ"
  filters={[
    { label: 'Período', value: '01/04/2026 a 30/04/2026' },
    { label: 'Funcionário', value: 'João Silva' },
  ]}
  summary={[
    { label: 'Total de Horas', value: '160:00', unit: 'horas' },
    { label: 'Dias Trabalhados', value: 20 },
    { label: 'Faltas', value: 0 },
  ]}
  columns={[
    { key: 'data', label: 'Data', align: 'center' },
    { key: 'entrada', label: 'Entrada', align: 'center' },
    { key: 'saida', label: 'Saída', align: 'center' },
  ]}
  data={[
    { data: '01/04/2026', entrada: '08:00', saida: '17:30' },
    { data: '02/04/2026', entrada: '08:15', saida: '17:30' },
  ]}
/>
```

### 2. Utilitários de Exportação
**Arquivo**: `src/utils/reportExport.ts`

Funções para exportar relatórios:
- ✅ `exportReportToPDF()` - Exporta para PDF limpo
- ✅ `exportReportToExcel()` - Exporta para Excel com dados completos
- ✅ `exportReport()` - Exporta para ambos os formatos

**Uso**:
```typescript
import { exportReport } from '@/utils/reportExport';

await exportReport({
  title: 'Espelho de Ponto',
  company: 'Empresa XYZ',
  filters: [...],
  summary: [...],
  columns: [...],
  data: [...],
  filename: 'espelho-ponto-2026-04',
}, ['pdf', 'excel']);
```

---

## 🔄 COMO REFATORAR RELATÓRIOS EXISTENTES

### Passo 1: Importar o Componente
```typescript
import ReportLayout from '@/components/Reports/ReportLayout';
import { exportReport } from '@/utils/reportExport';
```

### Passo 2: Preparar Dados
```typescript
const reportConfig = {
  title: 'Nome do Relatório',
  company: user.company?.name || 'Empresa',
  filters: [
    { label: 'Período', value: `${periodStart} a ${periodEnd}` },
    { label: 'Funcionário', value: filterUserId ? employees.find(e => e.id === filterUserId)?.nome : 'Todos' },
  ],
  summary: [
    { label: 'Total Geral', value: totalValue, unit: 'unidade' },
    { label: 'Indicador 1', value: indicator1 },
    { label: 'Indicador 2', value: indicator2 },
  ],
  columns: [
    { key: 'col1', label: 'Coluna 1', align: 'left' },
    { key: 'col2', label: 'Coluna 2', align: 'center' },
  ],
  data: processedData,
};
```

### Passo 3: Renderizar Componente
```typescript
return (
  <ReportLayout {...reportConfig}>
    <div className="flex gap-2">
      <button onClick={() => exportReport(reportConfig, ['pdf'])}>
        Exportar PDF
      </button>
      <button onClick={() => exportReport(reportConfig, ['excel'])}>
        Exportar Excel
      </button>
    </div>
  </ReportLayout>
);
```

---

## 📊 EXEMPLOS DE IMPLEMENTAÇÃO

### Exemplo 1: Espelho de Ponto (Já Implementado)
```typescript
const handleExportPDF = async () => {
  const config = {
    title: 'ESPELHO DE PONTO',
    company: user.company?.name || 'Empresa',
    filters: [
      { label: 'Período', value: `${periodStart} a ${periodEnd}` },
      { label: 'Funcionário', value: 'João Silva' },
    ],
    summary: [
      { label: 'Total de Horas', value: '160:00', unit: 'horas' },
      { label: 'Dias Trabalhados', value: 20 },
      { label: 'Faltas', value: 0 },
    ],
    columns: [
      { key: 'data', label: 'Data', align: 'center' },
      { key: 'entrada', label: 'Entrada', align: 'center' },
      { key: 'saida', label: 'Saída', align: 'center' },
      { key: 'horas', label: 'Horas', align: 'center' },
    ],
    data: timesheetData,
    filename: `espelho-ponto-${periodStart}-${periodEnd}`,
  };

  await exportReport(config, ['pdf']);
};
```

### Exemplo 2: Relatório de Horas Extras (Futuro)
```typescript
const handleExportOvertimeReport = async () => {
  const config = {
    title: 'RELATÓRIO DE HORAS EXTRAS',
    company: user.company?.name || 'Empresa',
    filters: [
      { label: 'Período', value: `${periodStart} a ${periodEnd}` },
      { label: 'Departamento', value: filterDept || 'Todos' },
    ],
    summary: [
      { label: 'Total de Horas Extras', value: totalExtra, unit: 'horas' },
      { label: 'Valor Total', value: `R$ ${totalValue}` },
      { label: 'Média por Funcionário', value: avgExtra, unit: 'horas' },
    ],
    columns: [
      { key: 'data', label: 'Data', align: 'center' },
      { key: 'funcionario', label: 'Funcionário', align: 'left' },
      { key: 'horas', label: 'Horas Extras', align: 'center' },
      { key: 'motivo', label: 'Motivo', align: 'left' },
      { key: 'aprovado', label: 'Aprovado', align: 'center' },
    ],
    data: overtimeData,
    filename: `horas-extras-${periodStart}-${periodEnd}`,
  };

  await exportReport(config, ['pdf', 'excel']);
};
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

Para cada novo relatório:

- [ ] Criar página em `src/pages/reports/`
- [ ] Importar `ReportLayout` e `exportReport`
- [ ] Preparar dados no formato correto
- [ ] Renderizar `ReportLayout` com dados
- [ ] Implementar botões de exportação
- [ ] Testar PDF (visual limpo)
- [ ] Testar Excel (dados completos)
- [ ] Verificar filtros aplicados
- [ ] Verificar resumo com indicadores
- [ ] Verificar tabela sem poluição visual
- [ ] Verificar sem dados técnicos
- [ ] Verificar alinhamento de colunas
- [ ] Verificar cores alternadas
- [ ] Verificar rodapé com data/hora

---

## 🎯 PRÓXIMOS RELATÓRIOS A IMPLEMENTAR

### 1. Relatório de Horas Extras
- **Pergunta**: Quantas horas extras foram trabalhadas?
- **Arquivo**: `src/pages/reports/OvertimeReport.tsx`
- **Prioridade**: Alta

### 2. Relatório de Ausências
- **Pergunta**: Qual é o padrão de ausências?
- **Arquivo**: `src/pages/reports/AbsenceReport.tsx`
- **Prioridade**: Alta

### 3. Relatório de Departamento
- **Pergunta**: Como está a produtividade do departamento?
- **Arquivo**: `src/pages/reports/DepartmentReport.tsx`
- **Prioridade**: Média

### 4. Relatório de Banco de Horas
- **Pergunta**: Qual é o saldo de banco de horas?
- **Arquivo**: `src/pages/reports/BankHoursReport.tsx`
- **Prioridade**: Média

---

## 📁 ESTRUTURA DE PASTAS

```
src/
├── components/
│   └── Reports/
│       └── ReportLayout.tsx ✅
├── pages/
│   └── reports/
│       ├── Timesheet.tsx (Espelho de Ponto) ✅
│       ├── OvertimeReport.tsx (Horas Extras) ⏳
│       ├── AbsenceReport.tsx (Ausências) ⏳
│       ├── DepartmentReport.tsx (Departamento) ⏳
│       └── BankHoursReport.tsx (Banco de Horas) ⏳
└── utils/
    └── reportExport.ts ✅
```

---

## 🚀 STATUS

- ✅ Padrão definido
- ✅ Componente base criado
- ✅ Utilitários de exportação criados
- ✅ Documentação completa
- ⏳ Refatoração de Espelho de Ponto
- ⏳ Implementação de novos relatórios

---

## 📝 NOTAS

- Todos os relatórios devem responder UMA pergunta clara
- Sem dados técnicos (IP, GPS, etc)
- Sem poluição visual
- Pronto para impressão
- Pronto para assinatura (se necessário)
- Exportável em PDF e Excel
