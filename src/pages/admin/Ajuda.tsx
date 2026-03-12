import React from 'react';
import { FileText, Info, LifeBuoy, ShieldCheck, FileSignature } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import RoleGuard from '../../components/auth/RoleGuard';
import { LoadingState } from '../../../components/UI';

const AdminAjuda: React.FC = () => {
  const { user, loading } = useCurrentUser();

  if (loading || !user) return <LoadingState message="Carregando..." />;

  return (
    <RoleGuard user={user} allowedRoles={['admin', 'hr']}>
      <div className="space-y-4">
        <PageHeader
          title="Ajuda e Informações"
          subtitle="Documentação básica do sistema, contrato de licenciamento e como obter suporte."
          icon={<FileText size={24} />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Como Obter Suporte */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Como Obter Suporte
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Em caso de dúvidas, erro inesperado ou necessidade de treinamento, utilize um dos canais abaixo:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                <strong>E-mail de suporte:</strong> informe empresa, CNPJ, contato e descreva o problema com dia/horário
                e, se possível, capturas de tela.
              </li>
              <li>
                <strong>Telefone / WhatsApp:</strong> para situações urgentes, especialmente quando impactarem fechamento
                de folha ou apuração de horas.
              </li>
              <li>
                <strong>Acesso remoto:</strong> quando autorizado, o time de suporte pode solicitar acesso remoto para
                análise mais detalhada.
              </li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dica: ao abrir um chamado, sempre informe o nome do funcionário, período, relatório e filtros utilizados.
            </p>
          </section>

          {/* Meu Software é Licenciado? */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Meu Software é Licenciado?
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              As informações de licenciamento são vinculadas ao seu cadastro de empresa e ao contrato vigente.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                <strong>Empresa:</strong> verifique em <span className="font-mono text-xs">Admin &gt; Empresa</span> os
                dados cadastrais e o identificador da sua instância.
              </li>
              <li>
                <strong>Usuários permitidos / módulos ativos:</strong> podem ser validados junto ao time comercial ou de
                suporte especializado.
              </li>
              <li>
                <strong>Ambiente de testes:</strong> quando disponível, será identificado claramente como ambiente de
                homologação.
              </li>
            </ul>
          </section>

          {/* Política de Privacidade */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Política de Privacidade
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              O sistema SmartPonto trata dados pessoais de colaboradores para fins de registro de ponto, gestão de
              jornada e cumprimento de obrigações legais trabalhistas.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Os dados são armazenados em provedores de nuvem seguros, com controles de acesso por empresa.</li>
              <li>
                Apenas usuários autorizados (por exemplo, administradores e RH) podem visualizar e alterar dados de
                funcionários.
              </li>
              <li>
                Logs de acesso e de alterações podem ser mantidos para fins de auditoria, conforme políticas internas.
              </li>
              <li>
                Os colaboradores podem solicitar acesso, correção ou esclarecimentos sobre seus dados por meio dos
                canais de suporte da empresa.
              </li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A política completa de privacidade deve ser fornecida pela sua empresa contratante e/ou pelo fornecedor do
              sistema, contemplando LGPD e demais normas aplicáveis.
            </p>
          </section>

          {/* Contrato de Licenciamento */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Contrato de Licenciamento
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              O uso deste sistema está condicionado à aceitação de um contrato de licenciamento entre sua empresa e o
              fornecedor do software.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>
                <strong>Escopo da licença:</strong> define quais módulos estão incluídos (cartão ponto, relatórios,
                espelho de ponto, etc.).
              </li>
              <li>
                <strong>Limites de uso:</strong> quantidade de usuários, empresas, filiais e ambientes cobertos pela
                licença.
              </li>
              <li>
                <strong>Atualizações e suporte:</strong> prazos e condições para correções, melhorias e suporte técnico.
              </li>
              <li>
                <strong>Responsabilidades:</strong> armazenamento de dados, backups, integrações com folha de pagamento
                e uso adequado das informações.
              </li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Em caso de dúvida sobre o contrato vigente, contate o responsável interno (TI/RH) ou o representante
              comercial do sistema.
            </p>
          </section>

          {/* Sobre o sistema */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-slate-700 dark:text-slate-200" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Sobre o sistema
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              SmartPonto é um sistema de controle de ponto eletrônico, focado em simplicidade de uso, conformidade
              legal e visão em tempo real da jornada.
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Registro de ponto por web, dispositivos móveis e integrações com equipamentos físicos.</li>
              <li>Relatórios de espelho de ponto, cartão ponto, ausências, ocorrências, escalas e distribuções.</li>
              <li>Recursos para arquivamento de cálculos, colunas mix, justificativas e integrações com folha.</li>
              <li>Painéis dedicados para administradores/RH e para colaboradores.</li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Versão instalada:{' '}
              <span className="font-mono">
                v1.4.0
              </span>
              . Informações adicionais de versão e build podem estar disponíveis no rodapé da aplicação ou nas notas de
              versão.
            </p>
          </section>
        </div>
      </div>
    </RoleGuard>
  );
};

export default AdminAjuda;

