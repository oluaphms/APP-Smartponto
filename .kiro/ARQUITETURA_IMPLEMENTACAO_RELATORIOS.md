# ARQUITETURA DE IMPLEMENTAÇÃO DOS 6 RELATÓRIOS

## 🏗️ ESTRUTURA GERAL

```
src/
├── components/
│   └── Reports/
│       ├── ReportLayout.tsx (Base - já existe)
│       ├── ReportHeader.tsx (Cabeçalho)
│       ├── ReportSummary.tsx (Cards de resumo)
│       ├── ReportTable.tsx (Tabela)
│       └── ReportFilters.tsx (Filtros)
│
├── pages/
│   └── reports/
│       ├── JourneyReport.tsx (Jornada)
│       ├── OvertimeReport.tsx (Horas Extras)
│       ├── InconsistencyReport.tsx (Inconsistências)
│       ├── BankHoursReport.tsx (Banco de Horas)
│       ├── SecurityReport.tsx (Segurança)
│       └── WorkedHoursReport.tsx (Horas Trabalhadas)
│
├── utils/
│   ├── reportExport.ts (Exportação - já existe)
│   ├── reportCalculations.ts (Cálculos)
│   ├── journeyCalculations.ts (Cálculos de jornada)
│   ├── overtimeCalculations.ts (Cálculos de extras)
│   ├── inconsistencyDetection.ts (Detecção de erros)
│   ├── bankHoursCalculations.ts (Cálculos de banco)
│   ├── securityAnalysis.ts (Análise de segurança)
│   └── workedHoursCalculations.ts (Cálculos de horas)
│
└── types/
    └── reports.ts (Tipos e interfaces)
```

---

## 📊 TIPOS E INTERFACES

```typescript
// src/types/reports.ts

export interface ReportFilter {
  label: string;
  value: string;
}

export interface ReportSummaryCard {
  label: string;
  value: string | number;
  unit?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

// Jornada
export interface JourneyData {
  funcionario: string;
  data: string;
  jornada_prevista: string;
  jornada_real: string;
  status: 'Cumprida' | 'Incompleta' | 'Excedida' | 'Ausente';
}

// Horas Extras
export interface OvertimeData {
  funcionario: string;
  data: string;
  horas_normais: string;
  horas_extras: string;
  tipo: '50%' | '100%' | 'Banco de Horas';
}

// Inconsistências
export interface InconsistencyData {
  funcionario: string;
  data: string;
  problema: string;
  gravidade: 'Leve' | 'Média' | 'Crítica';
  acao: string;
}

// Banco de Horas
export interface BankHoursData {
  funcionario: string;
  saldo_anterior: string;
  credito: string;
  debito: string;
  saldo_atual: string;
  status: 'OK' | 'Zerado' | 'Negativo';
}

// Segurança
export interface SecurityData {
  funcionario: string;
  data: string;
  tipo_evento: string;
  risco: 'Baixo' | 'Médio' | 'Alto';
  detalhes: string;
}

// Horas Trabalhadas
export interface WorkedHoursData {
  funcionario: string;
  dias_trabalhados: number;
  total_horas: string;
  media_diaria: string;
  variacao: string;
}
```

---

## 🔧 UTILITÁRIOS DE CÁLCULO

### 1. journeyCalculations.ts
```typescript
export function calculateJourneyStatus(
  expectedStart: string,
  expectedEnd: string,
  actualStart: string,
  actualEnd: string
): 'Cumprida' | 'Incompleta' | 'Excedida' | 'Ausente' {
  // Lógica de cálculo
}

export function getJourneyData(
  records: any[],
  employees: any[],
  startDate: string,
  endDate: string
): JourneyData[] {
  // Retorna dados formatados
}
```

### 2. overtimeCalculations.ts
```typescript
export function calculateOvertimeHours(
  actualHours: number,
  expectedHours: number
): { hours: number; type: string } {
  // Calcula horas extras
}

export function getOvertimeData(
  records: any[],
  startDate: string,
  endDate: string
): OvertimeData[] {
  // Retorna dados formatados
}
```

### 3. inconsistencyDetection.ts
```typescript
export function detectInconsistencies(
  records: any[]
): InconsistencyData[] {
  // Detecta problemas
}

export function getInconsistencySeverity(
  problem: string
): 'Leve' | 'Média' | 'Crítica' {
  // Determina gravidade
}
```

### 4. bankHoursCalculations.ts
```typescript
export function calculateBankHours(
  previousBalance: number,
  credits: number,
  debits: number
): { balance: number; status: string } {
  // Calcula saldo
}

export function getBankHoursData(
  employees: any[],
  cutoffDate: string
): BankHoursData[] {
  // Retorna dados formatados
}
```

### 5. securityAnalysis.ts
```typescript
export function analyzeSecurityRisk(
  records: any[]
): SecurityData[] {
  // Analisa comportamentos suspeitos
}

export function calculateRiskLevel(
  indicators: string[]
): 'Baixo' | 'Médio' | 'Alto' {
  // Calcula nível de risco
}
```

### 6. workedHoursCalculations.ts
```typescript
export function calculateWorkedHours(
  records: any[]
): WorkedHoursData[] {
  // Calcula horas trabalhadas
}

export function getVariation(
  actual: number,
  expected: number
): string {
  // Calcula variação percentual
}
```

---

## 📄 ESTRUTURA DE PÁGINA

Cada página de relatório segue este padrão:

```typescript
// src/pages/reports/JourneyReport.tsx

import React, { useState, useEffect } from 'react';
import ReportLayout from '@/components/Reports/ReportLayout';
import { exportReport } from '@/utils/reportExport';
import { getJourneyData } from '@/utils/journeyCalculations';

export const JourneyReport: React.FC = () => {
  const [filters, setFilters] = useState({
    periodStart: '',
    periodEnd: '',
    employeeId: '',
    departmentId: '',
  });

  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);

  useEffect(() => {
    // Carregar dados
    loadData();
  }, [filters]);

  const loadData = async () => {
    // Buscar dados do banco
    // Processar com utilitários de cálculo
    // Atualizar estado
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    await exportReport({
      title: 'RELATÓRIO DE JORNADA',
      company: user.company?.name || 'Empresa',
      filters: [
        { label: 'Período', value: `${filters.periodStart} a ${filters.periodEnd}` },
        { label: 'Funcionário', value: filters.employeeId || 'Todos' },
      ],
      summary,
      columns: [
        { key: 'funcionario', label: 'Funcionário', align: 'left' },
        { key: 'data', label: 'Data', align: 'center' },
        { key: 'jornada_prevista', label: 'Jornada Prevista', align: 'center' },
        { key: 'jornada_real', label: 'Jornada Real', align: 'center' },
        { key: 'status', label: 'Status', align: 'center' },
      ],
      data,
      filename: `jornada-${filters.periodStart}-${filters.periodEnd}`,
    }, [format]);
  };

  return (
    <ReportLayout {...reportConfig}>
      <div className="flex gap-2">
        <button onClick={() => handleExport('pdf')}>Exportar PDF</button>
        <button onClick={() => handleExport('excel')}>Exportar Excel</button>
      </div>
    </ReportLayout>
  );
};

export default JourneyReport;
```

---

## 🔄 FLUXO DE DADOS

```
1. Usuário acessa página de relatório
   ↓
2. Componente carrega com filtros padrão
   ↓
3. useEffect dispara loadData()
   ↓
4. Busca dados do Supabase
   ↓
5. Processa com utilitários de cálculo
   ↓
6. Formata para estrutura de relatório
   ↓
7. Atualiza estado (data, summary)
   ↓
8. ReportLayout renderiza com dados
   ↓
9. Usuário pode filtrar/exportar
```

---

## 📦 DEPENDÊNCIAS

Já instaladas:
- ✅ jsPDF
- ✅ jspdf-autotable
- ✅ xlsx (para Excel)

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

### Fase 1: Base (Já feito)
- ✅ ReportLayout.tsx
- ✅ reportExport.ts

### Fase 2: Relatórios Críticos (Próximo)
1. JourneyReport.tsx + journeyCalculations.ts
2. OvertimeReport.tsx + overtimeCalculations.ts
3. BankHoursReport.tsx + bankHoursCalculations.ts

### Fase 3: Relatórios Complementares
4. InconsistencyReport.tsx + inconsistencyDetection.ts
5. WorkedHoursReport.tsx + workedHoursCalculations.ts

### Fase 4: Diferencial
6. SecurityReport.tsx + securityAnalysis.ts

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

Para cada relatório:

- [ ] Criar página em `src/pages/reports/`
- [ ] Criar utilitários de cálculo em `src/utils/`
- [ ] Definir tipos em `src/types/reports.ts`
- [ ] Implementar loadData()
- [ ] Implementar handleExport()
- [ ] Testar com dados reais
- [ ] Validar PDF (visual limpo)
- [ ] Validar Excel (dados completos)
- [ ] Testar filtros
- [ ] Testar exportação
- [ ] Documentar no README

---

## 📝 PRÓXIMOS PASSOS

1. Criar tipos em `src/types/reports.ts`
2. Implementar utilitários de cálculo
3. Criar primeira página de relatório (Jornada)
4. Testar e validar
5. Replicar para outros relatórios
6. Deploy em produção

---

## 🎯 RESULTADO ESPERADO

Ao final:
- ✅ 6 relatórios funcionais
- ✅ Cada um respondendo uma pergunta clara
- ✅ Sem poluição visual
- ✅ Sem dados técnicos
- ✅ Exportáveis em PDF e Excel
- ✅ Prontos para ação
- ✅ Profissionais e confiáveis
