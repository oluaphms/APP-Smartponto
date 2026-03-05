import React, { useEffect, useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import ModalForm from '../components/ModalForm';
import { Button, Input, LoadingState } from '../../components/UI';
import { db, isSupabaseConfigured } from '../services/supabaseClient';
import { NotificationService } from '../../services/notificationService';
import { LoggingService } from '../../services/loggingService';
import { LogSeverity } from '../../types';

interface EmployeeRow {
  id: string;
  nome: string;
  email: string;
  department_id: string | null;
  schedule_name?: string | null;
  status: string;
}

interface WorkScheduleRow {
  id: string;
  name: string;
}

const EmployeesPage: React.FC = () => {
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRow | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const load = async () => {
      setIsLoadingData(true);
      try {
        const employees =
          (await db.select(
            'users',
            [{ column: 'company_id', operator: 'eq', value: user.companyId }],
            { column: 'created_at', ascending: false },
          )) ?? [];

        // Carregar escalas e associações
        const ws =
          (await db.select(
            'work_schedules',
            [{ column: 'company_id', operator: 'eq', value: user.companyId }],
          )) ?? [];
        const us =
          (await db.select(
            'user_schedules',
            [{ column: 'company_id', operator: 'eq', value: user.companyId }],
          )) ?? [];

        setSchedules(
          ws.map((w: any) => ({
            id: w.id,
            name: w.name,
          })),
        );

        setRows(
          employees.map((e: any) => {
            const link = us.find((u: any) => u.user_id === e.id);
            const schedule = ws.find((w: any) => w.id === link?.schedule_id);
            return {
              id: e.id,
              nome: e.nome,
              email: e.email,
              department_id: e.department_id,
              schedule_name: schedule?.name ?? null,
              status: 'Ativo',
            };
          }),
        );
      } catch (e) {
        console.error('Erro ao carregar funcionários:', e);
      } finally {
        setIsLoadingData(false);
      }
    };

    load();
  }, [user]);

  const openAssignSchedule = (emp: EmployeeRow) => {
    setSelectedEmployee(emp);
    setSelectedScheduleId('');
    setAssignModalOpen(true);
  };

  const handleAssignSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEmployee || !selectedScheduleId || !isSupabaseConfigured) return;

    try {
      // upsert simples: remove registros antigos deste user e insere um novo
      const existing =
        (await db.select(
          'user_schedules',
          [
            { column: 'user_id', operator: 'eq', value: selectedEmployee.id },
            { column: 'company_id', operator: 'eq', value: user.companyId },
          ],
        )) ?? [];
      for (const r of existing) {
        await db.delete('user_schedules', r.id);
      }

      await db.insert('user_schedules', {
        id: crypto.randomUUID(),
        user_id: selectedEmployee.id,
        company_id: user.companyId,
        schedule_id: selectedScheduleId,
        created_at: new Date().toISOString(),
      });

      const schedule = schedules.find((s) => s.id === selectedScheduleId);

      setRows((prev) =>
        prev.map((row) =>
          row.id === selectedEmployee.id
            ? { ...row, schedule_name: schedule?.name ?? row.schedule_name }
            : row,
        ),
      );

      await NotificationService.create({
        userId: selectedEmployee.id,
        type: 'info',
        title: 'Nova escala atribuída',
        message: `Você foi associado à escala ${schedule?.name ?? ''}.`,
      });

      await LoggingService.log({
        severity: LogSeverity.INFO,
        action: 'ASSIGN_SCHEDULE',
        userId: user.id,
        userName: user.nome,
        companyId: user.companyId,
        details: {
          employeeId: selectedEmployee.id,
          scheduleId: selectedScheduleId,
        },
      });

      setAssignModalOpen(false);
    } catch (err) {
      console.error('Erro ao atribuir escala:', err);
    }
  };

  if (loading || !user) {
    return <LoadingState message="Carregando funcionários..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funcionários"
        subtitle="Lista de colaboradores, departamentos e escalas"
        icon={<Users className="w-5 h-5" />}
        actions={
          <Button size="sm" disabled>
            <UserPlus className="w-4 h-4" />
            Novo funcionário (via Admin)
          </Button>
        }
      />

      {isLoadingData ? (
        <LoadingState message="Carregando colaboradores..." />
      ) : (
        <DataTable<EmployeeRow>
          columns={[
            { key: 'nome', header: 'Nome' },
            { key: 'email', header: 'Email' },
            {
              key: 'department_id',
              header: 'Departamento',
              render: (row) => row.department_id ?? '-',
            },
            {
              key: 'schedule_name',
              header: 'Escala',
              render: (row) => row.schedule_name ?? 'Não atribuída',
            },
            {
              key: 'status',
              header: 'Status',
            },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAssignSchedule(row)}
                  >
                    Atribuir escala
                  </Button>
                </div>
              ),
            },
          ]}
          data={rows}
        />
      )}

      <ModalForm
        title="Atribuir Escala"
        description={
          selectedEmployee
            ? `Selecione a escala de trabalho para ${selectedEmployee.nome}.`
            : ''
        }
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onSubmit={handleAssignSchedule}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!selectedScheduleId}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Escala
          </label>
          <select
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm"
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
          >
            <option value="">Selecione uma escala</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </ModalForm>
    </div>
  );
};

export default EmployeesPage;

