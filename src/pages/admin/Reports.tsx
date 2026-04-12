import React, { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Clock, TrendingUp, AlertTriangle, Scale, ShieldAlert, BarChart3 } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import { LoadingState } from '../../../components/UI';

const AdminReports: React.FC = () => {
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'ChronoDigital | Relatórios';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  if (loading) return <LoadingState message="Carregando..." />;
  if (!user) return <Navigate to="/" replace />;

  const reports = [
    {
      id: 'journey',
      title: 'Relatório de Jornada',
      description: 'O funcionário cumpriu a jornada?',
      icon: Clock,
      color: 'from-blue-500 to-blue-600',
      path: '/admin/reports/work-hours',
      badge: 'Essencial',
    },
    {
      id: 'overtime',
      title: 'Relatório de Horas Extras',
      description: 'Quanto foi trabalhado além da jornada?',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      path: '/admin/reports/overtime',
      badge: 'Essencial',
    },
    {
      id: 'inconsistency',
      title: 'Relatório de Inconsistências',
      description: 'O que está errado no ponto?',
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      path: '/admin/reports/inconsistencies',
      badge: 'Importante',
    },
    {
      id: 'bankHours',
      title: 'Relatório de Banco de Horas',
      description: 'Qual o saldo de cada funcionário?',
      icon: Scale,
      color: 'from-purple-500 to-purple-600',
      path: '/admin/reports/bank-hours',
      badge: 'Importante',
    },
    {
      id: 'security',
      title: 'Relatório de Segurança (Antifraude)',
      description: 'Existe comportamento suspeito?',
      icon: ShieldAlert,
      color: 'from-red-600 to-red-700',
      path: '/admin/reports/security',
      badge: 'Diferencial',
    },
    {
      id: 'workedHours',
      title: 'Relatório de Horas Trabalhadas',
      description: 'Quanto cada funcionário trabalhou?',
      icon: BarChart3,
      color: 'from-green-500 to-green-600',
      path: '/admin/reports/work-hours',
      badge: 'Essencial',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios"
        subtitle="Gere relatórios analíticos de jornada, horas extras, inconsistências e segurança"
        icon={<BarChart3 className="w-5 h-5" />}
      />

      {/* Grid de Relatórios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link
              key={report.id}
              to={report.path}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 hover:shadow-lg"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${report.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

              {/* Content */}
              <div className="relative p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${report.color} text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r ${report.color} text-white`}>
                    {report.badge}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-100 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {report.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                    Acessar relatório →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6">
        <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">💡 Dica</h3>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Cada relatório responde uma pergunta específica sobre a jornada dos seus funcionários. Use os filtros para refinar os dados e exporte em PDF ou Excel para compartilhar com sua equipe.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Relatórios Disponíveis</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">6</div>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Formatos de Exportação</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">2</div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">PDF + Excel</div>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Filtros</div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">∞</div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Data, Funcionário, Depto</div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
