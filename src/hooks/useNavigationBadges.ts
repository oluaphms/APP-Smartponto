import { useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured } from '../../services/supabase';
import { NotificationService } from '../../services/notificationService';
import type { User } from '../../types';

// Importação lazy do supabase client para evitar circular dependency
let _supabase: any = null;
async function getSupabaseClient() {
  if (_supabase) return _supabase;
  const mod = await import('../../services/supabase');
  _supabase = (mod as any).supabase ?? (mod as any).default;
  return _supabase;
}

export interface NavigationBadges {
  requestsCount: number;
  notificationsCount: number;
}

/** Intervalo de polling — 60s é suficiente para badges; reduz carga no banco */
const POLL_INTERVAL_MS = 60_000;

export function useNavigationBadges(user: User | null): NavigationBadges {
  const [requestsCount, setRequestsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const lastFetchRef = useRef(0);

  const load = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setRequestsCount(0);
      setNotificationsCount(0);
      return;
    }

    // Throttle: não buscar se já buscou há menos de 15s (evita chamadas em cascata)
    const now = Date.now();
    if (now - lastFetchRef.current < 15_000) return;
    lastFetchRef.current = now;

    const isAdmin = user.role === 'admin' || user.role === 'hr';

    // Usar count=exact do Supabase — retorna apenas o número, sem payload de linhas
    try {
      const client = await getSupabaseClient();
      if (client) {
        let query = client
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }

        const { count, error } = await query;
        if (!error && count != null) {
          setRequestsCount(count);
        }
      }
    } catch {
      setRequestsCount(0);
    }

    try {
      const count = await NotificationService.getUnreadCount(user.id);
      setNotificationsCount(count);
    } catch {
      setNotificationsCount(0);
    }
  }, [user]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { requestsCount, notificationsCount };
}
