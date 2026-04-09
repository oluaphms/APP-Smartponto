import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Banknote } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import { db, isSupabaseConfigured } from '../../services/supabaseClient';
import { LoadingState } from '../../../components/UI';

function fmtBRL(n: number): string {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Linha {
  id: string;
  ano: number;
  mes: number;
  status: string;
  salario_base: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
}

const EmployeeHolerite: React.FC = () => {
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<Linha[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !user?.companyId || !isSupabaseConfigured) {
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    try {
      const itens = (await db.select('folha_pagamento_itens', [
        { column: 'user_id', operator: 'eq', value: user.id },
        { column: 'company_id', operator: 'eq', value: user.companyId },
      ])) as any[];
      const periodos = (await db.select('folha_pagamento_periodos', [
        { column: 'company_id', operator: 'eq', value: user.companyId },
      ])) as any[];
      const pmap = new Map((periodos ?? []).map((p: any) => [p.id, p]));
      const merged: Linha[] = (itens ?? [])
        .map((it: any) => {
          const p = pmap.get(it.periodo_id);
          if (!p || p.status !== 'fechada') return null;
          return {
            id: it.id,
            ano: p.ano,
            mes: p.mes,
            status: p.status,
            salario_base: Number(it.salario_base) || 0,
            total_proventos: Number(it.total_proventos) || 0,
            total_descontos: Number(it.total_descontos) || 0,
            liquido: Number(it.liquido) || 0,
          };
        })
        .filter(Boolean) as Linha[];
      merged.sort((a, b) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes));
      setRows(merged);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoadingData(false);
    }
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Carregando..." />;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Contracheque (resumo)"
        subtitle="Valores consolidados pelo RH quando o período está fechado. Não substitui holerite legal nem discrimina automaticamente INSS, IRRF, FGTS, DSR sobre salário, férias + 1/3, 13º salário ou demais encargos — use o sistema de folha oficial da empresa para bases e descontos legais."
        icon={<Banknote size={24} />}
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden">
        {loadingData ? (
          <div className="p-12 text-center text-slate-500">Carregando...</div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-slate-500 dark:text-slate-400">
            Nenhum contracheque disponível. O RH precisa fechar a folha do mês em <strong>Folha de pagamento</strong> (área administrativa).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Competência</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Salário base</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Proventos</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Descontos</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-slate-400">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                      {String(r.mes).padStart(2, '0')}/{r.ano}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{fmtBRL(r.salario_base)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{fmtBRL(r.total_proventos)}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{fmtBRL(r.total_descontos)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300">{fmtBRL(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 leading-relaxed">
              Este resumo não comprova retenções oficiais nem substitui documento de folha com discriminação legal. Para INSS, IRRF, FGTS, férias, 13º e demais rubricas, consulte o holerite emitido pelo sistema oficial de folha da empresa ou o departamento pessoal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeHolerite;
