import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  emptyMessage = 'Nenhum registro encontrado',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-widest"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={(row as any).id ?? idx}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-6 py-4 align-middle text-sm">
                    {col.render ? col.render(row) : String((row as any)[col.key])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;

