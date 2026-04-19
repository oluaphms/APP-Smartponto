import { db } from '../../services/supabaseClient';
import { queryCache, TTL } from './queryCache';
import { handleError } from '../utils/handleError';

export interface AdminDashboardCards {
  totalEmployees: number;
  activeEmployees: number;
  recordsToday: number;
  absentToday: number;
}

export interface AdminDashboardPayload {
  cards: AdminDashboardCards;
  users: any[];
  recordsWeek: any[];
}

/**
 * Agrega dados do painel admin em chamadas controladas (evita N queries na UI).
 */
export async function getAdminDashboardData(companyId: string): Promise<AdminDashboardPayload | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const weekStart = sevenDaysAgo.toISOString().slice(0, 10);

    const [usersRows, recordsWeek] = await Promise.all([
      queryCache.getOrFetch(
        `users:${companyId}`,
        () => db.select('users', [{ column: 'company_id', operator: 'eq', value: companyId }]) as Promise<any[]>,
        TTL.NORMAL,
      ),
      queryCache.getOrFetch(
        `time_records:week:${companyId}:${today}`,
        () =>
          db.select(
            'time_records',
            [
              { column: 'company_id', operator: 'eq', value: companyId },
              { column: 'created_at', operator: 'gte', value: `${weekStart}T00:00:00.000Z` },
            ],
            { column: 'created_at', ascending: false },
            500,
          ) as Promise<any[]>,
        TTL.REALTIME,
      ),
    ]);

    const users = usersRows ?? [];
    const records = recordsWeek ?? [];
    const todayRecords = records.filter((r: any) => r.created_at?.slice(0, 10) === today);

    const activeIds = new Set<string>();
    todayRecords.forEach((r: any) => activeIds.add(r.user_id));
    const expectedEmployees = users.filter((u: any) => u.role !== 'admin' && u.role !== 'hr').length;
    const absentToday = Math.max(0, expectedEmployees - activeIds.size);

    const cards: AdminDashboardCards = {
      totalEmployees: users.length,
      activeEmployees: users.filter((u: any) => u.status !== 'inactive').length,
      recordsToday: todayRecords.length,
      absentToday,
    };

    return { cards, users, recordsWeek: records };
  } catch (e) {
    handleError(e, 'getAdminDashboardData');
    return null;
  }
}
