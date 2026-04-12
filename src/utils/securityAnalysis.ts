// ============================================================
// Análise de Segurança (Antifraude) para Relatório
// ============================================================

import { SecurityRow, SecuritySummary, ReportFilter } from '@/types/reports';
import { formatDateBR } from './journeyCalculations';

export interface SecurityData {
  employee: string;
  date: string;
  eventType: 'Localização inconsistente' | 'Troca de dispositivo' | 'Batida manual excessiva' | 'Falha de biometria' | 'Outro';
  riskLevel: 'Baixo' | 'Médio' | 'Alto';
  details?: string;
}

/**
 * Determina cor do nível de risco
 */
export const getRiskColor = (riskLevel: 'Baixo' | 'Médio' | 'Alto'): 'green' | 'orange' | 'red' => {
  switch (riskLevel) {
    case 'Baixo':
      return 'green';
    case 'Médio':
      return 'orange';
    case 'Alto':
      return 'red';
  }
};

/**
 * Calcula linhas do relatório de segurança
 */
export const calculateSecurityRows = (data: SecurityData[]): SecurityRow[] => {
  return data.map((item) => ({
    employee: item.employee,
    date: formatDateBR(item.date),
    eventType: item.eventType,
    riskLevel: item.riskLevel,
    riskColor: getRiskColor(item.riskLevel),
    details: item.details,
  }));
};

/**
 * Calcula resumo do relatório de segurança
 */
export const calculateSecuritySummary = (data: SecurityData[]): SecuritySummary => {
  const suspiciousEvents = data.length;
  const affectedEmployees = new Set(data.map((item) => item.employee)).size;
  const highRiskEvents = data.filter((item) => item.riskLevel === 'Alto').length;
  const mediumRiskEvents = data.filter((item) => item.riskLevel === 'Médio').length;
  const lowRiskEvents = data.filter((item) => item.riskLevel === 'Baixo').length;

  // Top 5 funcionários com mais eventos de risco
  const employeeRiskMap = new Map<string, number>();
  data.forEach((item) => {
    const current = employeeRiskMap.get(item.employee) || 0;
    employeeRiskMap.set(item.employee, current + 1);
  });

  const topRiskEmployees = Array.from(employeeRiskMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, riskCount]) => ({ name, riskCount }));

  return {
    suspiciousEvents,
    affectedEmployees,
    highRiskEvents,
    mediumRiskEvents,
    lowRiskEvents,
    topRiskEmployees,
  };
};

/**
 * Detecta eventos de segurança comuns
 */
export const detectSecurityEvents = (
  employee: string,
  date: string,
  punchData: {
    location?: string;
    device?: string;
    method?: string;
    biometricStatus?: string;
  }
): SecurityData[] => {
  const events: SecurityData[] = [];

  // Falha de biometria
  if (punchData.biometricStatus === 'failed') {
    events.push({
      employee,
      date,
      eventType: 'Falha de biometria',
      riskLevel: 'Médio',
      details: 'Falha ao processar biometria',
    });
  }

  // Batida manual excessiva
  if (punchData.method === 'manual') {
    events.push({
      employee,
      date,
      eventType: 'Batida manual excessiva',
      riskLevel: 'Baixo',
      details: 'Batida registrada manualmente',
    });
  }

  return events;
};

/**
 * Gera relatório completo de segurança
 */
export const generateSecurityReport = (
  data: SecurityData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateSecurityRows(data);
  const summary = calculateSecuritySummary(data);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Segurança (Antifraude)',
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
