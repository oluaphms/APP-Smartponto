// ============================================================
// Cálculos para Relatório de Horas Trabalhadas
// ============================================================

import { WorkedHoursRow, WorkedHoursSummary, ReportFilter } from '@/types/reports';
import { minutesToHHMM } from './journeyCalculations';

export interface WorkedHoursData {
  employee: string;
  daysWorked: number;
  totalHours: number; // em minutos
  expectedHours?: number; // em minutos (para calcular percentual)
}

/**
 * Calcula percentual de horas trabalhadas vs esperadas
 */
export const calculatePercentage = (worked: number, expected?: number): string => {
  if (!expected || expected === 0) return '100%';
  const percentage = (worked / expected) * 100;
  return `${percentage.toFixed(1)}%`;
};

/**
 * Calcula linhas do relatório de horas trabalhadas
 */
export const calculateWorkedHoursRows = (data: WorkedHoursData[]): WorkedHoursRow[] => {
  return data.map((item) => {
    const averageDaily = item.daysWorked > 0 ? Math.floor(item.totalHours / item.daysWorked) : 0;

    return {
      employee: item.employee,
      daysWorked: item.daysWorked,
      totalHours: minutesToHHMM(item.totalHours),
      averageDaily: minutesToHHMM(averageDaily),
      percentage: calculatePercentage(item.totalHours, item.expectedHours),
    };
  });
};

/**
 * Calcula resumo do relatório de horas trabalhadas
 */
export const calculateWorkedHoursSummary = (data: WorkedHoursData[]): WorkedHoursSummary => {
  const totalGeneralMinutes = data.reduce((sum, item) => sum + item.totalHours, 0);
  const totalEmployees = data.length;
  const totalDaysWorked = data.reduce((sum, item) => sum + item.daysWorked, 0);

  const averagePerEmployee = totalEmployees > 0 ? Math.floor(totalGeneralMinutes / totalEmployees) : 0;
  const averagePerDay = totalDaysWorked > 0 ? Math.floor(totalGeneralMinutes / totalDaysWorked) : 0;

  return {
    totalGeneralHours: minutesToHHMM(totalGeneralMinutes),
    averagePerEmployee: minutesToHHMM(averagePerEmployee),
    totalEmployees,
    totalDaysWorked,
    averagePerDay: minutesToHHMM(averagePerDay),
  };
};

/**
 * Gera relatório completo de horas trabalhadas
 */
export const generateWorkedHoursReport = (
  data: WorkedHoursData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateWorkedHoursRows(data);
  const summary = calculateWorkedHoursSummary(data);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Horas Trabalhadas',
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
