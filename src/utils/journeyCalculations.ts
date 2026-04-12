// ============================================================
// Cálculos para Relatório de Jornada
// ============================================================

import { JourneyRow, JourneySummary, ReportFilter } from '@/types/reports';

export interface JourneyData {
  employee: string;
  date: string;
  scheduledHours: number; // em minutos
  workedHours: number; // em minutos
}

/**
 * Converte minutos para formato HH:MM
 */
export const minutesToHHMM = (minutes: number): string => {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Converte HH:MM para minutos
 */
export const hhmmToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Formata data para DD/MM/YYYY
 */
export const formatDateBR = (date: string): string => {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

/**
 * Determina status da jornada
 */
export const getJourneyStatus = (
  scheduled: number,
  worked: number
): { status: 'Cumprida' | 'Incompleta' | 'Excedida' | 'Ausente'; color: 'green' | 'yellow' | 'blue' | 'red' } => {
  if (worked === 0) {
    return { status: 'Ausente', color: 'red' };
  }

  const tolerance = 5 * 60; // 5 minutos de tolerância
  const diff = worked - scheduled;

  if (Math.abs(diff) <= tolerance) {
    return { status: 'Cumprida', color: 'green' };
  }

  if (diff < 0) {
    return { status: 'Incompleta', color: 'yellow' };
  }

  return { status: 'Excedida', color: 'blue' };
};

/**
 * Calcula linhas do relatório de jornada
 */
export const calculateJourneyRows = (data: JourneyData[]): JourneyRow[] => {
  return data.map((item) => {
    const { status, color: statusColor } = getJourneyStatus(item.scheduledHours, item.workedHours);

    return {
      employee: item.employee,
      date: formatDateBR(item.date),
      scheduledHours: minutesToHHMM(item.scheduledHours),
      workedHours: minutesToHHMM(item.workedHours),
      status,
      statusColor,
    };
  });
};

/**
 * Calcula resumo do relatório de jornada
 */
export const calculateJourneySummary = (rows: JourneyRow[]): JourneySummary => {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'Cumprida').length;
  const incomplete = rows.filter((r) => r.status === 'Incompleta').length;
  const exceeded = rows.filter((r) => r.status === 'Excedida').length;
  const absent = rows.filter((r) => r.status === 'Ausente').length;

  const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

  return {
    totalDays: total,
    completedDays: completed,
    incompleteDays: incomplete,
    exceededDays: exceeded,
    absentDays: absent,
    completionRate: `${completionRate}%`,
  };
};

/**
 * Gera relatório completo de jornada
 */
export const generateJourneyReport = (
  data: JourneyData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateJourneyRows(data);
  const summary = calculateJourneySummary(rows);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Jornada',
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
