// ============================================================
// Componente Container Reutilizável para Relatórios
// ============================================================

import React from 'react';
import { ReportHeader, ReportSummary } from '@/types/reports';

interface ReportContainerProps {
  header: ReportHeader;
  summary: ReportSummary;
  children: React.ReactNode;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

export const ReportContainer: React.FC<ReportContainerProps> = ({
  header,
  summary,
  children,
  onExportPDF,
  onExportExcel,
}) => {
  return (
    <div className="w-full bg-white rounded-lg shadow-lg p-6">
      {/* Cabeçalho */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{header.title}</h1>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-semibold">Empresa:</span> {header.company}
          </div>
          <div>
            <span className="font-semibold">Período:</span> {header.period}
          </div>
          <div>
            <span className="font-semibold">Gerado em:</span> {header.generatedAt}
          </div>
          {header.filters.employees && header.filters.employees.length > 0 && (
            <div>
              <span className="font-semibold">Funcionários:</span> {header.filters.employees.join(', ')}
            </div>
          )}
          {header.filters.departments && header.filters.departments.length > 0 && (
            <div>
              <span className="font-semibold">Departamentos:</span> {header.filters.departments.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Resumo (Cards) */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Resumo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-sm font-semibold text-gray-600 capitalize mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="text-2xl font-bold text-blue-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="mb-8">{children}</div>

      {/* Botões de Exportação */}
      <div className="flex gap-4 justify-end pt-6 border-t border-gray-200">
        {onExportPDF && (
          <button
            onClick={onExportPDF}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            📄 Exportar PDF
          </button>
        )}
        {onExportExcel && (
          <button
            onClick={onExportExcel}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            📊 Exportar Excel
          </button>
        )}
      </div>
    </div>
  );
};
