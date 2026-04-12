# Guia de Integração dos Relatórios

## 1. Adicionar Rotas

Editar `src/routes/routeChunks.ts` ou arquivo de rotas:

```typescript
// Importar os relatórios
import JourneyReport from '@/pages/reports/JourneyReport';
import OvertimeReport from '@/pages/reports/OvertimeReport';
import InconsistencyReport from '@/pages/reports/InconsistencyReport';
import BankHoursReport from '@/pages/reports/BankHoursReport';
import SecurityReport from '@/pages/reports/SecurityReport';
import WorkedHoursReport from '@/pages/reports/WorkedHoursReport';

// Adicionar rotas
const reportRoutes = [
  {
    path: '/reports/journey',
    element: <JourneyReport />,
    label: 'Relatório de Jornada',
  },
  {
    path: '/reports/overtime',
    element: <OvertimeReport />,
    label: 'Relatório de Horas Extras',
  },
  {
    path: '/reports/inconsistency',
    element: <InconsistencyReport />,
    label: 'Relatório de Inconsistências',
  },
  {
    path: '/reports/bank-hours',
    element: <BankHoursReport />,
    label: 'Relatório de Banco de Horas',
  },
  {
    path: '/reports/security',
    element: <SecurityReport />,
    label: 'Relatório de Segurança',
  },
  {
    path: '/reports/worked-hours',
    element: <WorkedHoursReport />,
    label: 'Relatório de Horas Trabalhadas',
  },
];
```

## 2. Adicionar Menu

Editar `src/components/navigation/SmartSidebar.tsx` ou arquivo de navegação:

```typescript
{
  label: 'Relatórios',
  icon: '📊',
  submenu: [
    { label: 'Jornada', path: '/reports/journey' },
    { label: 'Horas Extras', path: '/reports/overtime' },
    { label: 'Inconsistências', path: '/reports/inconsistency' },
    { label: 'Banco de Horas', path: '/reports/bank-hours' },
    { label: 'Segurança', path: '/reports/security' },
    { label: 'Horas Trabalhadas', path: '/reports/worked-hours' },
  ],
}
```

## 3. Implementar Páginas Restantes

### Template para OvertimeReport.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { ReportContainer } from '@/components/Reports/ReportContainer';
import { ReportTable } from '@/components/Reports/ReportTable';
import { StatusBadge } from '@/components/Reports/StatusBadge';
import { OvertimeReport as OvertimeReportType, ReportFilter } from '@/types/reports';
import { generateOvertimeReport } from '@/utils/overtimeCalculations';
import { exportReportToPDF, exportReportToExcel } from '@/utils/reportExport';

export const OvertimeReport: React.FC = () => {
  const [report, setReport] = useState<OvertimeReportType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      // TODO: Buscar dados da API
      const mockData = [
        {
          employee: 'João Silva',
          date: '2026-04-11',
          normalHours: 480,
          extraHours: 120, // 2 horas
          type: '100%' as const,
        },
      ];

      const filter: ReportFilter = {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        companyId: 'default',
      };

      const generatedReport = generateOvertimeReport(mockData, filter, 'Empresa');
      setReport(generatedReport);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (!report) return <div>Sem dados</div>;

  return (
    <div className="p-6">
      <ReportContainer
        header={report.header}
        summary={report.summary}
        onExportPDF={() => exportReportToPDF(report, 'overtime')}
        onExportExcel={() => exportReportToExcel(report, 'overtime')}
      >
        <ReportTable
          title="Detalhes de Horas Extras"
          columns={[
            { key: 'employee', label: 'Funcionário', sortable: true },
            { key: 'date', label: 'Data', sortable: true },
            { key: 'normalHours', label: 'Horas Normais', sortable: true },
            { key: 'extraHours', label: 'Horas Extras', sortable: true },
            {
              key: 'type',
              label: 'Tipo',
              sortable: true,
              render: (value) => <StatusBadge status={value} />,
            },
          ]}
          data={report.rows}
        />
      </ReportContainer>
    </div>
  );
};

export default OvertimeReport;
```

## 4. Conectar com Dados Reais

### Exemplo: Buscar dados do Supabase

```typescript
const loadReport = async () => {
  try {
    setLoading(true);

    // Buscar time_records
    const { data: records, error } = await supabase
      .from('time_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    // Transformar em formato esperado
    const journeyData = records.map(record => ({
      employee: record.employee_name,
      date: record.date,
      scheduledHours: record.scheduled_minutes,
      workedHours: record.worked_minutes,
    }));

    // Gerar relatório
    const filter: ReportFilter = {
      startDate,
      endDate,
      companyId: currentUser.company_id,
    };

    const report = generateJourneyReport(journeyData, filter, company.name);
    setReport(report);
  } finally {
    setLoading(false);
  }
};
```

## 5. Adicionar Filtros Avançados

```typescript
const [filters, setFilters] = useState({
  startDate: '',
  endDate: '',
  employees: [] as string[],
  departments: [] as string[],
});

// Usar em loadReport()
const filter: ReportFilter = {
  startDate: filters.startDate,
  endDate: filters.endDate,
  employeeIds: filters.employees,
  departmentIds: filters.departments,
  companyId: currentUser.company_id,
};
```

## 6. Testar Localmente

```bash
# Acessar relatório de jornada
http://localhost:3000/reports/journey

# Testar exportação PDF
Clicar em "Exportar PDF"

# Testar exportação Excel
Clicar em "Exportar Excel"
```

## 7. Checklist de Implementação

- [ ] Rotas adicionadas
- [ ] Menu atualizado
- [ ] 6 páginas de relatórios criadas
- [ ] Dados conectados ao Supabase
- [ ] Filtros funcionando
- [ ] Exportação PDF testada
- [ ] Exportação Excel testada
- [ ] Responsivo em mobile
- [ ] Tratamento de erros
- [ ] Performance otimizada

## 8. Estrutura de Pastas

```
src/
├── types/
│   └── reports.ts ✅
├── utils/
│   ├── journeyCalculations.ts ✅
│   ├── overtimeCalculations.ts ✅
│   ├── inconsistencyDetection.ts ✅
│   ├── bankHoursCalculations.ts ✅
│   ├── securityAnalysis.ts ✅
│   ├── workedHoursCalculations.ts ✅
│   └── reportExport.ts ✅
├── components/
│   └── Reports/
│       ├── ReportContainer.tsx ✅
│       ├── ReportTable.tsx ✅
│       └── StatusBadge.tsx ✅
└── pages/
    └── reports/
        ├── JourneyReport.tsx ✅
        ├── OvertimeReport.tsx ⏳
        ├── InconsistencyReport.tsx ⏳
        ├── BankHoursReport.tsx ⏳
        ├── SecurityReport.tsx ⏳
        └── WorkedHoursReport.tsx ⏳
```

## 9. Dependências Necessárias

```json
{
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.5.31",
  "xlsx": "^0.18.5"
}
```

Verificar se já estão instaladas:
```bash
npm list jspdf jspdf-autotable xlsx
```

## 10. Troubleshooting

### Erro: "Cannot find module 'jspdf'"
```bash
npm install jspdf jspdf-autotable
```

### Erro: "Cannot find module 'xlsx'"
```bash
npm install xlsx
```

### Relatório não carrega dados
- Verificar console para erros
- Validar query do Supabase
- Verificar permissões RLS

### Exportação PDF vazia
- Verificar se dados estão sendo carregados
- Validar estrutura do relatório
- Testar com dados de exemplo

---

## Próximas Etapas

1. ✅ Estrutura base criada
2. ⏳ Implementar 5 páginas restantes
3. ⏳ Conectar com dados reais
4. ⏳ Adicionar gráficos
5. ⏳ Otimizar performance
6. ⏳ Testes automatizados
