import { useEffect } from 'react';
import { db, isSupabaseConfigured } from '../services/supabaseClient';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimeOptions<TPayload = any> {
  table: string;
  filter?: string;
  events?: EventType[];
  onPayload: (payload: TPayload) => void;
}

/**
 * Hook genérico para inscrições realtime em tabelas do Supabase.
 *
 * Exemplo:
 * useSupabaseRealtime({
 *   table: 'time_records',
 *   onPayload: (payload) => { ... }
 * });
 */
export function useSupabaseRealtime<TPayload = any>({
  table,
  filter,
  events = ['*'],
  onPayload,
}: RealtimeOptions<TPayload>) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = db.subscribe(table, (payload: any) => {
        if (events.includes('*') || events.includes(payload.eventType as EventType)) {
          onPayload(payload as TPayload);
        }
      }, filter);
    } catch (e) {
      console.error('Erro ao configurar realtime Supabase:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [table, filter, events, onPayload]);
}

