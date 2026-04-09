import React, { useEffect, useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileDown, MapPin } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import { db, isSupabaseConfigured } from '../../services/supabaseClient';
import { LoadingState } from '../../../components/UI';
import { buildDayMirrorSummary } from '../../utils/timesheetMirror';
import { extractLatLng } from '../../utils/reverseGeocode';
import { ExpandableStreetCell, ExpandableTextCell } from '../../components/ClickableFullContent';

const EmployeeTimesheet: React.FC = () => {
  const { user, loading } = useCurrentUser();
  const [records, setRecords] = useState<any[]>([]);
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [loadingData, setLoadingData] = useState(true);
  /** Detalhe “localização por batida” visível por data (clique na coluna Data). */
  const [detailOpenByDate, setDetailOpenByDate] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const load = async () => {
      setLoadingData(true);
      try {
        // Usa filtro de data no banco para reduzir carga e evitar dados de dias errados
        const startDate = periodStart;
        const endDate = periodEnd;
        const rows = (await db.select(
          'time_records',
          [
            { column: 'user_id', operator: 'eq', value: user.id },
            { column: 'created_at', operator: 'gte', value: `${startDate}T00:00:00` },
            { column: 'created_at', operator: 'lte', value: `${endDate}T23:59:59` },
          ],
          { column: 'created_at', ascending: false },
          500
        )) as any[];
        setRecords(rows ?? []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user?.id, periodStart, periodEnd]);

  /** Registros agrupados por dia (ordenados por horário). */
  const { byDate, recordsByDate } = useMemo(() => {
    const byDay = new Map<string, any[]>();
    records.forEach((r: any) => {
      const d = (r.created_at || '').slice(0, 10);
      if (!d) return;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(r);
    });
    byDay.forEach((arr) => {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    const summary = new Map<string, ReturnType<typeof buildDayMirrorSummary>>();
    byDay.forEach((arr, d) => {
      summary.set(d, buildDayMirrorSummary(arr));
    });
    return { byDate: summary, recordsByDate: byDay };
  }, [records]);

  const dates = useMemo(() => [...new Set(records.map((r: any) => (r.created_at || '').slice(0, 10)))].sort().reverse(), [records]);

  const toggleDayDetail = (dateKey: string) => {
    setDetailOpenByDate((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const exportPDF = () => window.print();

  if (loading) return <LoadingState message="Carregando..." />;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <PageHeader title="Espelho de Ponto" />

      <div className="flex flex-wrap gap-4 items-end p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 print:hidden">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Período (início)</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Período (fim)</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
        </div>
        <button type="button" onClick={exportPDF} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          <FileDown className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-x-auto print:border-0 print:shadow-none print:bg-transparent print:overflow-visible">
        {loadingData ? (
          <div className="p-12 text-center text-slate-500">Carregando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Data</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Entrada (início)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Intervalo (pausa)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Retorno</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Saída (final)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Horas trabalhadas</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Locais (resumo)</th>
                <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => {
                const sum = byDate.get(d);
                const dayRecs = recordsByDate.get(d) ?? [];
                const withGps = dayRecs.filter((r: any) => extractLatLng(r));
                return (
                  <React.Fragment key={d}>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-[120px] align-top">
                        {dayRecs.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleDayDetail(d)}
                            className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1 -mx-1 py-0.5 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                            aria-expanded={detailOpenByDate[d] === true}
                            title="Clique para mostrar ou ocultar localização por batida"
                          >
                            {detailOpenByDate[d] ? (
                              <ChevronDown className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                            ) : (
                              <ChevronRight className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                            )}
                            <span className="tabular-nums text-slate-900 dark:text-white">{d}</span>
                          </button>
                        ) : (
                          <span className="tabular-nums">{d}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums max-w-[120px] align-top">
                        <ExpandableTextCell label="Entrada (início)" value={sum?.entradaInicio || ''} empty="—" />
                      </td>
                      <td className="px-4 py-3 tabular-nums max-w-[120px] align-top">
                        <ExpandableTextCell label="Intervalo (pausa)" value={sum?.saidaIntervalo || ''} empty="—" />
                      </td>
                      <td className="px-4 py-3 tabular-nums max-w-[120px] align-top">
                        <ExpandableTextCell label="Retorno" value={sum?.voltaIntervalo || ''} empty="—" />
                      </td>
                      <td className="px-4 py-3 tabular-nums max-w-[120px] align-top">
                        <ExpandableTextCell label="Saída (final)" value={sum?.saidaFinal || ''} empty="—" />
                      </td>
                      <td className="px-4 py-3 tabular-nums max-w-[120px] align-top">
                        <ExpandableTextCell label="Horas trabalhadas" value={sum?.workedHours || ''} empty="—" />
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs w-[min(100%,11rem)] max-w-[11rem] min-w-0 align-top">
                        {withGps.length > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-indigo-500" aria-hidden />
                            <span>
                              {withGps.length} batida{withGps.length !== 1 ? 's' : ''} com local
                            </span>
                          </span>
                        ) : dayRecs.length > 0 ? (
                          <span className="text-slate-500">Sem GPS nas batidas</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] align-top">
                        <ExpandableTextCell label="Status" value={sum?.status || 'OK'} />
                      </td>
                    </tr>
                    {dayRecs.length > 0 && detailOpenByDate[d] === true && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 print:bg-transparent">
                        <td colSpan={8} className="px-4 py-3">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Localização por batida — {d}
                          </p>
                          <div className="space-y-2">
                            {dayRecs.map((r: any) => {
                              const ll = extractLatLng(r);
                              const when = r.created_at
                                ? new Date(r.created_at).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—';
                              return (
                                <div
                                  key={r.id || `${d}-${when}-${r.type}`}
                                  className="flex flex-wrap items-start gap-x-3 gap-y-1 text-xs"
                                >
                                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                                    {when}
                                  </span>
                                  <span className="uppercase text-[10px] px-2 py-0.5 rounded-md bg-slate-200/90 dark:bg-slate-700 text-slate-800 dark:text-slate-100 shrink-0">
                                    {(r.type || '—').toString()}
                                  </span>
                                  <div className="min-w-0 flex-1 basis-[min(100%,18rem)] max-w-xl">
                                    {ll ? (
                                      <ExpandableStreetCell lat={ll.lat} lng={ll.lng} previewMaxLength={28} />
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400">Batida sem GPS</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        {!loadingData && dates.length === 0 && (
          <p className="p-8 text-center text-slate-500 dark:text-slate-400">Nenhum registro no período.</p>
        )}
      </div>
    </div>
  );
};

export default EmployeeTimesheet;
