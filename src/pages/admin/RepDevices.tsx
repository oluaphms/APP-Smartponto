import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import PageHeader from '../../components/PageHeader';
import { db, supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { LoadingState, Button } from '../../../components/UI';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  UserPlus,
  Download,
  Upload,
  ArrowLeftRight,
} from 'lucide-react';
import { testRepDeviceConnection, syncRepDevice } from '../../../modules/rep-integration/repSyncJob';
import {
  pushEmployeeToDeviceViaApi,
  repExchangeViaApi,
  toUiString,
} from '../../../modules/rep-integration/repDeviceBrowser';
import type { RepDeviceClockSet, RepExchangeOp, RepUserFromDevice } from '../../../modules/rep-integration/types';

type RepDeviceRow = {
  id: string;
  company_id: string;
  nome_dispositivo: string;
  fabricante: string | null;
  modelo: string | null;
  ip: string | null;
  porta: number | null;
  tipo_conexao: string;
  status: string | null;
  ultima_sincronizacao: string | null;
  ativo: boolean;
  created_at: string;
  config_extra?: Record<string, unknown> | null;
};

type EmployeeForRep = {
  id: string;
  nome: string;
  status: string;
  invisivel: boolean;
  demissao: string | null;
};

function isEmployeeEligibleForRepPush(e: EmployeeForRep): boolean {
  if (e.invisivel) return false;
  if (e.demissao) return false;
  return (e.status || 'active').toLowerCase() === 'active';
}

const TIPOS_CONEXAO = [
  { value: 'rede', label: 'Rede (IP)' },
  { value: 'arquivo', label: 'Importação de arquivo' },
  { value: 'api', label: 'API do fabricante' },
];

/** Fuso no formato Control iD Portaria 671 (ex.: -0300). */
function formatTimezoneOffset671(d: Date): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}${mm}`;
}

function buildLocalClockForRep(mode671: boolean): RepDeviceClockSet {
  const d = new Date();
  const clock: RepDeviceClockSet = {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
  if (mode671) clock.timezone = formatTimezoneOffset671(d);
  return clock;
}

const AdminRepDevices: React.FC = () => {
  const { user, loading } = useCurrentUser();
  const [devices, setDevices] = useState<RepDeviceRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeForRep[]>([]);
  /** `${deviceId}:${op}` enquanto /api/rep/exchange roda */
  const [exchangeBusy, setExchangeBusy] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ title: string; body: string } | null>(null);
  const [usersModal, setUsersModal] = useState<{ title: string; users: RepUserFromDevice[] } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  /** Em HTTPS (produção): nota sobre nuvem vs rede local e agente. */
  const [repDeploymentNote, setRepDeploymentNote] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  /** Modal Enviar e Receber (REP rede) */
  const [sendReceiveOpen, setSendReceiveOpen] = useState(false);
  const [srDeviceId, setSrDeviceId] = useState('');
  const [srLog, setSrLog] = useState('');
  /** Se marcado, não oferece no envio ao relógio inativos/demitidos/invisíveis. */
  const [srSkipBlocked, setSrSkipBlocked] = useState(true);
  const [srPushUserId, setSrPushUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configExtraBaseline, setConfigExtraBaseline] = useState<Record<string, unknown>>({});
  const [form, setForm] = useState({
    nome_dispositivo: '',
    fabricante: '',
    modelo: '',
    ip: '',
    porta: 80,
    tipo_conexao: 'rede' as 'rede' | 'arquivo' | 'api',
    ativo: true,
    repHttps: false,
    tlsInsecure: false,
    repStatusPost: false,
    repLogin: 'admin',
    repPassword: 'admin',
    mode671: false,
  });

  const loadDevices = async () => {
    if (!user?.companyId || !isSupabaseConfigured) return;
    setLoadingList(true);
    try {
      const list = (await db.select('rep_devices', [{ column: 'company_id', operator: 'eq', value: user.companyId }])) as RepDeviceRow[];
      setDevices(list || []);
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user?.companyId) loadDevices();
  }, [user?.companyId]);

  const loadEmployeesForRep = async () => {
    if (!user?.companyId || !isSupabaseConfigured) return;
    try {
      const rows = (await db.select('users', [{ column: 'company_id', operator: 'eq', value: user.companyId }])) as {
        id: string;
        nome: string | null;
        email: string | null;
        role: string | null;
        status?: string | null;
        invisivel?: boolean | null;
        demissao?: string | null;
      }[];
      const allowed = new Set(['employee', 'hr', 'admin']);
      const list = (rows || [])
        .filter((r) => allowed.has(String(r.role || '').toLowerCase()))
        .map((r) => ({
          id: r.id,
          nome: (r.nome || r.email || r.id).trim(),
          status: (r.status || 'active').trim(),
          invisivel: r.invisivel === true,
          demissao: r.demissao || null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      setEmployees(list);
    } catch {
      setEmployees([]);
    }
  };

  useEffect(() => {
    if (user?.companyId) loadEmployeesForRep();
  }, [user?.companyId]);

  useEffect(() => {
    setRepDeploymentNote(typeof window !== 'undefined' && window.isSecureContext);
  }, []);

  const redeDevices = useMemo(
    () => devices.filter((d) => d.tipo_conexao === 'rede'),
    [devices]
  );

  const srSelectedDevice = useMemo(
    () => (srDeviceId ? devices.find((d) => d.id === srDeviceId) ?? null : null),
    [devices, srDeviceId]
  );

  const employeesForModalPush = useMemo(() => {
    if (!srSkipBlocked) return employees;
    return employees.filter(isEmployeeEligibleForRepPush);
  }, [employees, srSkipBlocked]);

  const srActionsLocked = useMemo(() => {
    const d = srSelectedDevice;
    if (!d) return true;
    if (syncingId === d.id || pushingId === d.id) return true;
    if (exchangeBusy && exchangeBusy.startsWith(`${d.id}:`)) return true;
    return false;
  }, [srSelectedDevice, syncingId, pushingId, exchangeBusy]);

  const appendSrLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setSrLog((prev) => (prev ? `${prev}\n` : '') + `[${ts}] ${line}`);
  }, []);

  const openSendReceiveModal = () => {
    const rede = devices.filter((d) => d.tipo_conexao === 'rede');
    setSrDeviceId(rede.length === 1 ? rede[0].id : '');
    setSrLog('');
    setSrSkipBlocked(true);
    setSrPushUserId('');
    setSendReceiveOpen(true);
  };

  const handleTestConnection = async (id: string) => {
    if (!supabase) return;
    setTestingId(id);
    setMessage(null);
    try {
      const r = await testRepDeviceConnection(supabase, id);
      setMessage({
        type: r.ok ? 'success' : 'error',
        text: toUiString(r.message, r.ok ? 'Conexão OK' : 'Falha ao testar o relógio.'),
      });
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Excluir o relógio "${nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await db.delete('rep_devices', id);
      setMessage({ type: 'success', text: 'Dispositivo removido.' });
      await loadDevices();
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setDeletingId(null);
    }
  };

  const srRunReceivePunches = async () => {
    const d = srSelectedDevice;
    if (!d || d.tipo_conexao !== 'rede') {
      appendSrLog('Selecione um equipamento de rede.');
      return;
    }
    if (!supabase) return;
    appendSrLog(`Recebendo marcações de "${d.nome_dispositivo}"…`);
    setSyncingId(d.id);
    setMessage(null);
    try {
      const r = await syncRepDevice(supabase, d.id);
      if (r.ok) {
        appendSrLog(`Concluído: ${r.imported} marcação(ões) importada(s).`);
        setMessage({ type: 'success', text: `Sincronizado. ${r.imported} marcações importadas.` });
      } else {
        const errLine = toUiString(r.error, 'Erro ao sincronizar');
        appendSrLog(`Falha: ${errLine}`);
        setMessage({ type: 'error', text: errLine });
      }
      await loadDevices();
    } catch (e) {
      appendSrLog(`Erro: ${(e as Error).message}`);
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setSyncingId(null);
    }
  };

  const srRunSendClock = async () => {
    const d = srSelectedDevice;
    if (!d || d.tipo_conexao !== 'rede') {
      appendSrLog('Selecione um equipamento de rede.');
      return;
    }
    if (!supabase) return;
    const mode671 = d.config_extra?.mode_671 === true;
    setExchangeBusy(`${d.id}:push_clock`);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        appendSrLog('Sessão expirada. Faça login novamente.');
        setMessage({ type: 'error', text: 'Sessão expirada. Faça login novamente.' });
        return;
      }
      appendSrLog(`Enviando data e hora para "${d.nome_dispositivo}"…`);
      const clock = buildLocalClockForRep(mode671);
      const r = await repExchangeViaApi(d.id, 'push_clock', session.access_token, clock);
      if (!r.ok) {
        const errLine = toUiString(r.error ?? r.message, 'Operação não concluída.');
        appendSrLog(`Falha: ${errLine}`);
        setMessage({ type: 'error', text: toUiString(r.error ?? r.message, 'Operação falhou.') });
        return;
      }
      const okLine = toUiString(r.message, 'Data e hora gravadas no relógio.');
      appendSrLog(okLine);
      setMessage({ type: 'success', text: okLine });
    } catch (e) {
      appendSrLog(`Erro: ${(e as Error).message}`);
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setExchangeBusy(null);
    }
  };

  const srRunExchangeOp = async (op: RepExchangeOp) => {
    const d = srSelectedDevice;
    if (!d || d.tipo_conexao !== 'rede') {
      appendSrLog('Selecione um equipamento de rede.');
      return;
    }
    if (!supabase) return;
    const mode671 = d.config_extra?.mode_671 === true;
    setExchangeBusy(`${d.id}:${op}`);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        appendSrLog('Sessão expirada. Faça login novamente.');
        setMessage({ type: 'error', text: 'Sessão expirada. Faça login novamente.' });
        return;
      }
      const startMsg: Partial<Record<RepExchangeOp, string>> = {
        pull_clock: 'Lendo data e hora do relógio…',
        pull_info: 'Lendo informações do aparelho…',
        pull_users: 'Lendo cadastros no relógio…',
      };
      if (startMsg[op]) appendSrLog(startMsg[op]!);
      const clock = op === 'push_clock' ? buildLocalClockForRep(mode671) : undefined;
      const r = await repExchangeViaApi(d.id, op, session.access_token, clock);
      if (!r.ok) {
        const errLine = toUiString(r.error ?? r.message, 'Operação não concluída.');
        appendSrLog(`Falha: ${errLine}`);
        setMessage({ type: 'error', text: toUiString(r.error ?? r.message, 'Operação falhou.') });
        return;
      }
      if (op === 'pull_clock') {
        const body =
          typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? {}, null, 2);
        setDetailModal({ title: 'Data e hora no relógio', body });
        appendSrLog('Hora lida. Abra o painel de detalhes.');
        setMessage({ type: 'success', text: 'Hora lida do relógio.' });
      } else if (op === 'pull_info') {
        const body =
          typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? {}, null, 2);
        setDetailModal({ title: 'Informações do aparelho', body });
        appendSrLog('Informações lidas. Abra o painel de detalhes.');
        setMessage({ type: 'success', text: 'Configurações lidas do relógio.' });
      } else if (op === 'pull_users') {
        setUsersModal({
          title: `Funcionários no relógio — ${d.nome_dispositivo}`,
          users: r.users ?? [],
        });
        appendSrLog(`${(r.users ?? []).length} cadastro(s) listado(s) no relógio.`);
        setMessage({
          type: 'success',
          text: `${(r.users ?? []).length} cadastro(s) no relógio (somente leitura).`,
        });
      }
    } catch (e) {
      appendSrLog(`Erro: ${(e as Error).message}`);
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setExchangeBusy(null);
    }
  };

  const srRunPushEmployee = async () => {
    const d = srSelectedDevice;
    if (!d || d.tipo_conexao !== 'rede') {
      appendSrLog('Selecione um equipamento de rede.');
      return;
    }
    const userId = srPushUserId;
    if (!supabase || !userId) {
      appendSrLog('Selecione um funcionário para enviar ao relógio.');
      return;
    }
    const emp = employees.find((e) => e.id === userId);
    if (srSkipBlocked && emp && !isEmployeeEligibleForRepPush(emp)) {
      appendSrLog('Funcionário bloqueado ou inativo — não enviado. Desmarque a opção ou ajuste o cadastro.');
      return;
    }
    setPushingId(d.id);
    setMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        appendSrLog('Sessão expirada. Faça login novamente.');
        setMessage({ type: 'error', text: 'Sessão expirada. Faça login novamente.' });
        return;
      }
      appendSrLog(`Enviando cadastro ao relógio "${d.nome_dispositivo}"…`);
      const r = await pushEmployeeToDeviceViaApi(d.id, userId, session.access_token);
      const msg = toUiString(r.message, r.ok ? 'Cadastro enviado ao relógio.' : 'Falha ao enviar ao relógio.');
      if (r.ok) {
        appendSrLog(msg);
      } else {
        appendSrLog(`Falha: ${msg}`);
      }
      setMessage({ type: r.ok ? 'success' : 'error', text: msg });
    } catch (e) {
      appendSrLog(`Erro: ${(e as Error).message}`);
      setMessage({ type: 'error', text: (e as Error).message });
    } finally {
      setPushingId(null);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setConfigExtraBaseline({});
    setForm({
      nome_dispositivo: '',
      fabricante: '',
      modelo: '',
      ip: '',
      porta: 80,
      tipo_conexao: 'rede',
      ativo: true,
      repHttps: false,
      tlsInsecure: false,
      repStatusPost: false,
      repLogin: 'admin',
      repPassword: 'admin',
      mode671: false,
    });
    setModalOpen(true);
  };

  const openEdit = (d: RepDeviceRow) => {
    setEditingId(d.id);
    const ex =
      d.config_extra && typeof d.config_extra === 'object' ? { ...d.config_extra } : ({} as Record<string, unknown>);
    setConfigExtraBaseline(ex);
    setForm({
      nome_dispositivo: d.nome_dispositivo,
      fabricante: d.fabricante || '',
      modelo: d.modelo || '',
      ip: d.ip || '',
      porta: d.porta ?? 80,
      tipo_conexao: (d.tipo_conexao as 'rede' | 'arquivo' | 'api') || 'rede',
      ativo: d.ativo,
      repHttps: ex.https === true || ex.protocol === 'https',
      tlsInsecure: ex.tls_insecure === true || ex.accept_self_signed === true,
      repStatusPost: ex.status_use_post === true,
      repLogin: typeof ex.rep_login === 'string' ? ex.rep_login : 'admin',
      repPassword: typeof ex.rep_password === 'string' ? ex.rep_password : 'admin',
      mode671: ex.mode_671 === true,
    });
    setModalOpen(true);
  };

  const saveDevice = async () => {
    if (!user?.companyId || !form.nome_dispositivo.trim()) return;
    try {
      if (editingId) {
        const config_extra = {
          ...configExtraBaseline,
          https: form.repHttps,
          tls_insecure: form.tlsInsecure,
          status_use_post: form.repStatusPost,
          rep_login: form.repLogin.trim() || 'admin',
          rep_password: form.repPassword,
          mode_671: form.mode671,
        };
        await db.update('rep_devices', editingId, {
          nome_dispositivo: form.nome_dispositivo.trim(),
          fabricante: form.fabricante.trim() || null,
          modelo: form.modelo.trim() || null,
          ip: form.ip.trim() || null,
          porta: form.porta || null,
          tipo_conexao: form.tipo_conexao,
          ativo: form.ativo,
          config_extra,
          updated_at: new Date().toISOString(),
        });
        setMessage({ type: 'success', text: 'Dispositivo atualizado.' });
      } else {
        await db.insert('rep_devices', {
          company_id: user.companyId,
          nome_dispositivo: form.nome_dispositivo.trim(),
          fabricante: form.fabricante.trim() || null,
          modelo: form.modelo.trim() || null,
          ip: form.ip.trim() || null,
          porta: form.porta || null,
          tipo_conexao: form.tipo_conexao,
          ativo: form.ativo,
          status: 'inativo',
          config_extra: {
            https: form.repHttps,
            tls_insecure: form.tlsInsecure,
            status_use_post: form.repStatusPost,
            rep_login: form.repLogin.trim() || 'admin',
            rep_password: form.repPassword,
            mode_671: form.mode671,
          },
        });
        setMessage({ type: 'success', text: 'Dispositivo cadastrado.' });
      }
      setModalOpen(false);
      loadDevices();
    } catch (e) {
      setMessage({ type: 'error', text: (e as Error).message });
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleString('pt-BR');
    } catch {
      return s;
    }
  };

  if (loading) return <LoadingState message="Carregando..." />;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Relógios REP"
        subtitle="Cadastre relógios e use Enviar e Receber para batidas, hora, funcionários e leitura de configuração (Control iD iDClass e compatíveis)."
        icon={<Clock size={24} />}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" onClick={openSendReceiveModal}>
              <ArrowLeftRight size={18} className="mr-2" />
              Enviar e Receber
            </Button>
            <Button onClick={openCreate} variant="primary">
              <Plus size={18} className="mr-2" />
              Cadastrar relógio
            </Button>
          </div>
        }
      />

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}
        >
          {message.text}
        </div>
      )}

      {repDeploymentNote && (
        <div
          className="mb-4 px-4 py-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 text-sm leading-relaxed"
          role="status"
        >
          <strong className="font-semibold">Arquitetura REP:</strong> o painel usa apenas rotas HTTPS do próprio app (
          <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">/api/rep/status</code>,{' '}
          <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">/api/rep/punches</code>,{' '}
          <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">/api/rep/push-employee</code>,{' '}
          <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">/api/rep/exchange</code>
          ) — sem mixed content nem CORS para o IP do relógio. Em <strong>produção na nuvem</strong> o backend não alcança
          <code className="text-xs mx-1 bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">192.168.x.x</code>: use o
          agente local <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">npm run rep:agent</code>,{' '}
          <strong>importação AFD/arquivo</strong>, ou rode <code className="text-xs bg-amber-100/80 dark:bg-amber-900/50 px-1 rounded">npm run dev</code> na
          mesma rede do relógio para o proxy alcançar o aparelho.
        </div>
      )}

      {loadingList ? (
        <LoadingState message="Carregando dispositivos..." />
      ) : (
        <>
          {/* Mobile: layout em cards (stack) para evitar overflow horizontal */}
          <div className="md:hidden space-y-3">
            {devices.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                Nenhum relógio cadastrado. Clique em &quot;Cadastrar relógio&quot; para adicionar.
              </div>
            ) : (
              devices.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white break-words">{d.nome_dispositivo}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
                        {[d.fabricante, d.modelo].filter(Boolean).join(' / ') || '—'}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        d.status === 'ativo'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : d.status === 'erro'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {d.status === 'ativo' ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {d.status || 'inativo'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Conexão</span>
                      <span className="text-slate-700 dark:text-slate-200 text-right break-all">
                        {d.tipo_conexao === 'rede' && d.ip
                          ? `${d.ip}:${d.porta ?? 80}`
                          : TIPOS_CONEXAO.find((t) => t.value === d.tipo_conexao)?.label ?? d.tipo_conexao}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Última sincronização</span>
                      <span className="text-slate-700 dark:text-slate-200 text-right">{formatDate(d.ultima_sincronizacao)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.tipo_conexao === 'rede' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[100px]"
                        disabled={testingId === d.id}
                        onClick={() => handleTestConnection(d.id)}
                      >
                        Testar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="min-w-[44px]" onClick={() => openEdit(d)}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-w-[44px] text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                      disabled={deletingId === d.id}
                      onClick={() => handleDelete(d.id, d.nome_dispositivo)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  {d.tipo_conexao === 'rede' && (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Control iD: PIS/CPF no cadastro do funcionário; modo 671 exige CPF de 11 dígitos para envio.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop/Tablet: tabela com scroll horizontal se necessário */}
          <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[880px] w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Nome</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Fabricante / Modelo</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Conexão</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Última sincronização</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Nenhum relógio cadastrado. Clique em &quot;Cadastrar relógio&quot; para adicionar.
                      </td>
                    </tr>
                  ) : (
                    devices.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.nome_dispositivo}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {[d.fabricante, d.modelo].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {d.tipo_conexao === 'rede' && d.ip
                            ? `${d.ip}:${d.porta ?? 80}`
                            : TIPOS_CONEXAO.find((t) => t.value === d.tipo_conexao)?.label ?? d.tipo_conexao}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              d.status === 'ativo'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                : d.status === 'erro'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {d.status === 'ativo' ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {d.status || 'inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-sm">{formatDate(d.ultima_sincronizacao)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {d.tipo_conexao === 'rede' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={testingId === d.id}
                                onClick={() => handleTestConnection(d.id)}
                              >
                                Testar
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                              <Pencil size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30"
                              disabled={deletingId === d.id}
                              onClick={() => handleDelete(d.id, d.nome_dispositivo)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {sendReceiveOpen && (
        <div
          className="fixed inset-0 z-[128] flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rep-send-receive-title"
          onClick={() => setSendReceiveOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                <ArrowLeftRight size={22} />
              </span>
              <div>
                <h2 id="rep-send-receive-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Enviar e Receber
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comunicação com o relógio pela rede (importação, horário e cadastros).
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Equipamento</label>
                <select
                  value={srDeviceId}
                  onChange={(e) => setSrDeviceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                >
                  <option value="">Selecione o relógio…</option>
                  {redeDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome_dispositivo}
                      {d.ip ? ` — ${d.ip}:${d.porta ?? 80}` : ''}
                    </option>
                  ))}
                </select>
                {redeDevices.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Cadastre um dispositivo do tipo rede (IP) para habilitar esta tela.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <textarea
                  readOnly
                  rows={8}
                  value={srLog}
                  placeholder="As mensagens da comunicação aparecem aqui."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 text-xs font-mono leading-relaxed resize-y min-h-[140px]"
                />
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-3 bg-slate-50/80 dark:bg-slate-900/30">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Opções</p>
                <label className="flex gap-2 items-start opacity-70 cursor-not-allowed">
                  <input type="checkbox" disabled className="mt-0.5 rounded border-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Salvar batidas em tabela temporária
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      No Chrono Digital as marcações importadas são gravadas direto nos registros de ponto; não há fila
                      temporária separada.
                    </span>
                  </span>
                </label>
                <label className="flex gap-2 items-start opacity-70 cursor-not-allowed">
                  <input type="checkbox" disabled className="mt-0.5 rounded border-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Alocar batidas
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      Associação automática a escalas será evoluída em versões futuras.
                    </span>
                  </span>
                </label>
                <label className="flex gap-2 items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srSkipBlocked}
                    onChange={(e) => setSrSkipBlocked(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Não enviar funcionários bloqueados
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      Ao enviar cadastro ao relógio, considera apenas perfis ativos (exclui demitidos, invisíveis e status
                      diferente de ativo).
                    </span>
                  </span>
                </label>
                <label className="flex gap-2 items-start opacity-70 cursor-not-allowed">
                  <input type="checkbox" disabled className="mt-0.5 rounded border-slate-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Barras padrão especial
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      Indisponível; o cartão de ponto segue o layout padrão do Chrono Digital.
                    </span>
                  </span>
                </label>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="font-medium text-slate-600 dark:text-slate-300">Receber</strong> importa as marcações do
                relógio para o sistema. <strong className="font-medium text-slate-600 dark:text-slate-300">Enviar</strong>{' '}
                grava a data e hora deste computador no aparelho.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 min-w-[100px]"
                  disabled={srActionsLocked || redeDevices.length === 0}
                  onClick={srRunReceivePunches}
                >
                  <Download size={16} className="mr-1.5" />
                  Receber
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 min-w-[100px]"
                  disabled={srActionsLocked || redeDevices.length === 0}
                  onClick={srRunSendClock}
                >
                  <Upload size={16} className="mr-1.5" />
                  Enviar
                </Button>
                <Button type="button" variant="secondary" className="min-w-[88px]" onClick={() => setSendReceiveOpen(false)}>
                  Fechar
                </Button>
              </div>

              <details className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200 select-none">
                  Outras operações no relógio
                </summary>
                <div className="mt-3 space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Receber (leituras)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={srActionsLocked || !srSelectedDevice}
                      onClick={() => srRunExchangeOp('pull_clock')}
                    >
                      Ler hora
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={srActionsLocked || !srSelectedDevice}
                      onClick={() => srRunExchangeOp('pull_users')}
                    >
                      Funcionários no aparelho
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={srActionsLocked || !srSelectedDevice}
                      onClick={() => srRunExchangeOp('pull_info')}
                    >
                      Info / config
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">Enviar cadastro</p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] text-slate-500 mb-0.5">Funcionário</label>
                      <select
                        value={srPushUserId}
                        onChange={(e) => setSrPushUserId(e.target.value)}
                        disabled={employeesForModalPush.length === 0}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                      >
                        <option value="">Selecione…</option>
                        {employeesForModalPush.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={srActionsLocked || !srSelectedDevice || !srPushUserId || employeesForModalPush.length === 0}
                      onClick={srRunPushEmployee}
                    >
                      <UserPlus size={14} className="mr-1" />
                      Enviar ao relógio
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {detailModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{detailModal.title}</h2>
            <pre className="text-xs text-slate-700 dark:text-slate-200 overflow-auto flex-1 max-h-[60vh] whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
              {detailModal.body}
            </pre>
            <Button className="mt-4" variant="secondary" onClick={() => setDetailModal(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}

      {usersModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setUsersModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{usersModal.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Somente leitura — não altera o cadastro do Chrono Digital.
            </p>
            <div className="overflow-auto flex-1 max-h-[55vh] rounded-lg border border-slate-200 dark:border-slate-600">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">Nome</th>
                    <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">CPF/PIS</th>
                    <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">Matrícula</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {usersModal.users.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-500">
                        Nenhum usuário retornado.
                      </td>
                    </tr>
                  ) : (
                    usersModal.users.map((u, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{u.nome || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{u.cpf || u.pis || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{u.matricula || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Button className="mt-4" variant="secondary" onClick={() => setUsersModal(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 sm:p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {editingId ? 'Editar relógio' : 'Novo relógio REP'}
            </h2>
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome *</label>
                <input
                  type="text"
                  value={form.nome_dispositivo}
                  onChange={(e) => setForm((f) => ({ ...f, nome_dispositivo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Ex: Recepção"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fabricante</label>
                <input
                  type="text"
                  value={form.fabricante}
                  onChange={(e) => setForm((f) => ({ ...f, fabricante: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Ex: Control iD, Henry"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Modelo</label>
                <input
                  type="text"
                  value={form.modelo}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de integração</label>
                <select
                  value={form.tipo_conexao}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_conexao: e.target.value as 'rede' | 'arquivo' | 'api' }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {TIPOS_CONEXAO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.tipo_conexao === 'rede' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">IP</label>
                    <input
                      type="text"
                      value={form.ip}
                      onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Porta</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={form.porta}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        const n = Number.isNaN(v) ? 80 : Math.min(65535, Math.max(1, v));
                        setForm((f) => ({ ...f, porta: n }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {form.repHttps ? (
                        <>
                          Com HTTPS, a porta típica é <strong className="font-medium">443</strong>. Digitar{' '}
                          <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">0443</code> vira 443 — não é erro.
                          Confira no manual se a <em>API de marcações</em> usa a mesma porta do painel web.
                        </>
                      ) : (
                        <>
                          Em HTTP, costuma ser <strong className="font-medium">80</strong> ou <strong className="font-medium">8080</strong>.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.repHttps}
                        onChange={(e) => setForm((f) => ({ ...f, repHttps: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Usar HTTPS (relógio com TLS)
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 pl-6">
                      A maioria dos relógios na LAN usa <strong className="font-medium">HTTP</strong> (porta 80 ou 8080). Só marque HTTPS se o manual do aparelho indicar TLS.
                    </p>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.tlsInsecure}
                        onChange={(e) => setForm((f) => ({ ...f, tlsInsecure: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Aceitar certificado autoassinado (só rede interna confiável)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.repStatusPost}
                        onChange={(e) => setForm((f) => ({ ...f, repStatusPost: e.target.checked }))}
                        className="rounded border-slate-300"
                      />
                      Teste de conexão usa POST (JSON <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{}'}</code>)
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 pl-6">
                      Alguns aparelhos só aceitam POST em <code className="text-xs">/api/status</code>. Se não marcar, o sistema tenta GET e repete com POST se o relógio responder &quot;POST expected&quot;.
                    </p>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-600 mt-2">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        Control iD (API iDClass no relógio)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-0.5">Usuário web do REP</label>
                          <input
                            type="text"
                            value={form.repLogin}
                            onChange={(e) => setForm((f) => ({ ...f, repLogin: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-0.5">Senha</label>
                          <input
                            type="password"
                            value={form.repPassword}
                            onChange={(e) => setForm((f) => ({ ...f, repPassword: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={form.mode671}
                          onChange={(e) => setForm((f) => ({ ...f, mode671: e.target.checked }))}
                          className="rounded border-slate-300"
                        />
                        AFD Portaria 671 (<code className="text-xs">mode=671</code> no download)
                      </label>
                    </div>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <label htmlFor="ativo" className="text-sm text-slate-700 dark:text-slate-300">
                  Ativo (incluir na sincronização automática)
                </label>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="w-full sm:w-auto" onClick={saveDevice}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRepDevices;
