// ============================================================
// Detecção de Inconsistências para Relatório
// ============================================================

import { InconsistencyRow, InconsistencySummary, ReportFilter } from '@/types/reports';
import { formatDateBR } from './journeyCalculations';

export interface InconsistencyData {
  employee: string;
  date: string;
  problem: 'Falta de batida' | 'Intervalo irregular' | 'Jornada incompleta' | 'Batida duplicada' | 'Outro';
  severity: 'Leve' | 'Média' | 'Crítica';
  details?: string;
}

/**
 * Determina cor da severidade
 */
export const getSeverityColor = (severity: 'Leve' | 'Média' | 'Crítica'): 'yellow' | 'orange' | 'red' => {
  switch (severity) {
    case 'Leve':
      return 'yellow';
    case 'Média':
      return 'orange';
    case 'Crítica':
      return 'red';
  }
};

/**
 * Calcula linhas do relatório de inconsistências
 */
export const calculateInconsistencyRows = (data: InconsistencyData[]): InconsistencyRow[] => {
  return data.map((item) => ({
    employee: item.employee,
    date: formatDateBR(item.date),
    problem: item.problem,
    severity: item.severity,
    severityColor: getSeverityColor(item.severity),
    details: item.details,
  }));
};

/**
 * Calcula resumo do relatório de inconsistências
 */
export const calculateInconsistencySummary = (data: InconsistencyData[]): InconsistencySummary => {
  const totalInconsistencies = data.length;
  const affectedEmployees = new Set(data.map((item) => item.employee)).size;
  const criticalIssues = data.filter((item) => item.severity === 'Crítica').length;
  const mediumIssues = data.filter((item) => item.severity === 'Média').length;
  const lightIssues = data.filter((item) => item.severity === 'Leve').length;

  return {
    totalInconsistencies,
    affectedEmployees,
    criticalIssues,
    mediumIssues,
    lightIssues,
  };
};

/**
 * Detecta inconsistências comuns
 */
export const detectCommonInconsistencies = (
  employee: string,
  date: string,
  punchData: {
    entrada?: string;
    saida?: string;
    intervalo?: string;
    retorno?: string;
  }
): InconsistencyData[] => {
  const inconsistencies: InconsistencyData[] = [];

  // Falta de batida
  if (!punchData.entrada && !punchData.saida) {
    inconsistencies.push({
      employee,
      date,
      problem: 'Falta de batida',
      severity: 'Crítica',
      details: 'Nenhuma batida registrada para este dia',
    });
  }

  // Intervalo irregular
  if (punchData.entrada && punchData.intervalo) {
    const entrada = parseInt(punchData.entrada.replace(':', ''));
    const intervalo = parseInt(punchData.intervalo.replace(':', ''));

    if (intervalo - entrada < 120) {
      // Menos de 2 horas
      inconsistencies.push({
        employee,
        date,
        problem: 'Intervalo irregular',
        severity: 'Média',
        details: `Intervalo muito curto: ${punchData.intervalo}`,
      });
    }
  }

  // Jornada incompleta
  if (punchData.entrada && !punchData.saida) {
    inconsistencies.push({
      employee,
      date,
      problem: 'Jornada incompleta',
      severity: 'Média',
      details: 'Falta registro de saída',
    });
  }

  return inconsistencies;
};

/**
 * Gera relatório completo de inconsistências
 */
export const generateInconsistencyReport = (
  data: InconsistencyData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateInconsistencyRows(data);
  const summary = calculateInconsistencySummary(data);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Inconsistências',
      company,
      period: `${startDate} a ${endDate}`,
      filters: {
        employees: filter.employeeIds,
        departments: filter.departmentIds,
      },
      generatedAt: new Date().toLocaleString('pt-BR'),
    },
    summary,
    rows,
  };
};
