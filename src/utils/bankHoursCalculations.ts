// ============================================================
// Cálculos para Relatório de Banco de Horas
// ============================================================

import { BankHoursRow, BankHoursSummary, ReportFilter } from '@/types/reports';
import { minutesToHHMM, hhmmToMinutes, formatDateBR } from './journeyCalculations';

export interface BankHoursData {
  employee: string;
  previousBalance: number; // em minutos (+ ou -)
  credit: number; // em minutos
  debit: number; // em minutos
}

/**
 * Calcula saldo atual
 */
export const calculateCurrentBalance = (
  previousBalance: number,
  credit: number,
  debit: number
): number => {
  return previousBalance + credit - debit;
};

/**
 * Determina cor do saldo
 */
export const getBalanceColor = (balance: number): 'green' | 'red' => {
  return balance >= 0 ? 'green' : 'red';
};

/**
 * Calcula linhas do relatório de banco de horas
 */
export const calculateBankHoursRows = (data: BankHoursData[]): BankHoursRow[] => {
  return data.map((item) => {
    const currentBalance = calculateCurrentBalance(item.previousBalance, item.credit, item.debit);

    return {
      employee: item.employee,
      previousBalance: minutesToHHMM(item.previousBalance),
      credit: minutesToHHMM(item.credit),
      debit: minutesToHHMM(item.debit),
      currentBalance: minutesToHHMM(currentBalance),
      balanceColor: getBalanceColor(currentBalance),
    };
  });
};

/**
 * Calcula resumo do relatório de banco de horas
 */
export const calculateBankHoursSummary = (data: BankHoursData[]): BankHoursSummary => {
  let totalPositive = 0;
  let totalNegative = 0;
  let employeesWithPositive = 0;
  let employeesWithNegative = 0;

  data.forEach((item) => {
    const currentBalance = calculateCurrentBalance(item.previousBalance, item.credit, item.debit);

    if (currentBalance > 0) {
      totalPositive += currentBalance;
      employeesWithPositive++;
    } else if (currentBalance < 0) {
      totalNegative += Math.abs(currentBalance);
      employeesWithNegative++;
    }
  });

  const netBalance = totalPositive - totalNegative;

  return {
    totalPositive: minutesToHHMM(totalPositive),
    totalNegative: minutesToHHMM(totalNegative),
    employeesWithPositive,
    employeesWithNegative,
    netBalance: minutesToHHMM(netBalance),
  };
};

/**
 * Gera relatório completo de banco de horas
 */
export const generateBankHoursReport = (
  data: BankHoursData[],
  filter: ReportFilter,
  company: string
) => {
  const rows = calculateBankHoursRows(data);
  const summary = calculateBankHoursSummary(data);

  const startDate = new Date(filter.startDate).toLocaleDateString('pt-BR');
  const endDate = new Date(filter.endDate).toLocaleDateString('pt-BR');

  return {
    header: {
      title: 'Relatório de Banco de Horas',
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
