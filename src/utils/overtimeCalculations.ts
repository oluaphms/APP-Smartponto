// ============================================================
// Cálculos para Relatório de Horas Extras
// ============================================================

import { OvertimeRow, OvertimeSummary, ReportFilter } from '@/types/reports';
import { minutesToHHMM, hhmmToMinutes, formatDateBR } from './journeyCalculations';

export interface OvertimeData {
  employee: string;
  date: string;
  normalHours: number; // em minutos
  extraHours: number; // em minutos
  type: '50%' | '100%' | 'Banco de Horas';
}

/**
 * Determina cor do tipo de hora extra
 */
export const getOvertimeTypeColor = (type: '50%' | '100%' | 'Banco de Horas'): 'orange' | 'red' | 'blue' => {
  switch (type) {
    case '50%':
      return 'orange';
    case '100%':
      return 'red';
    case 'Banco de Horas':
      return 'blue';
  }
};

/**
 * Calcula linhas do relatório de horas extras
 */
export const calculateOvertimeRows = (data: OvertimeData[]): OvertimeRow[] => {
  return data
    .filter((item) => item.extraHours > 0) // Apenas registros com horas extras
    .map((item) => ({
      employee: item.employee,
      date: formatDateBR(item.date),
      normalHours: minutesToHHMM(item.normalHours),
      extraHours: minutesToHHMM(item.extraHours),
      type: item.type,
      typeColor: getOvertimeTypeColor(item.type),
    }));
};

/**
 * Calcula resumo do relatório de horas extras
 */
export const calculateOvertimeSummary = (data: OvertimeData[]): OvertimeSummary => {
  const withOvertime = data.filter((item) => item.extraHours > 0);

  const totalExtraMinutes = withOvertime.reduce((sum, item) => sum + item.extraHours, 0);
  const daysWithOvertime = new Set(withOvertime.map((item) => item.date)).size;

  const hours50 = withOvertime.filter((item) => item.type === '50%').reduce((sum, item) => sum + item.extraHours, 0);
  const hours100 = withOvertime.filter((item) => item.type === '100%').reduce((sum, item) => sum + item.extraHours, 0);
  const bankHours = withOvertime.filter((item) => item.type === 'Banco de Horas').reduce((sum, item) => sum + item.extraHours, 0);

  return {
    totalExtraHours: minutesToHHMM(totalExtraMinutes),
    daysWithOvertime,
    hours50Percent: minutesToHHMM(hours50),
    hours100Percent: minutesToHHMM(hours100),
    bankHours: minutesToHHMM(bankHours),
  };
};

/**
 * Gera relatório completo de horas extras
 */
export const generateOvertimeReport = (
  data: OvertimeData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateOvertimeRows(data);
  const summary = calculateOvertimeSummary(data);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Horas Extras',
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
