import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TimeRecord, LogType, PunchMethod } from '../../types';
import { PontoService } from '../../services/pontoService';
import { OfflinePunchService } from '../../services/offlinePunchService';
import { timeRecordsQueries } from '../../services/queryOptimizations';
import { invalidateAfterPunch } from '../services/queryCache';
import { supabase } from '../../services/supabase';

export const useRecords = (userId: string | undefined, companyId: string | undefined) => {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Cache com staleTime zero: dados do relógio chegam a cada 10-15s,
  // não faz sentido manter cache de 1 minuto.
  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['records', userId],
    queryFn: () => userId ? timeRecordsQueries.getRecordsByUser(userId, 50, 0).then(r => r.data || []) : Promise.resolve([]),
    enabled: !!userId,
    staleTime: 0,
  });

  // Realtime: invalida cache automaticamente quando time_records recebe INSERT
  // Isso garante que batidas do relógio aparecem sem refresh manual.
  useEffect(() => {
    if (!userId || !companyId) return;

    const channel = supabase
      .channel(`time_records:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'time_records',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['records', userId] });
          invalidateAfterPunch(userId, companyId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, companyId, queryClient]);

  const refreshRecords = useCallback(async (force = false) => {
    if (force) {
      await refetch();
    }
  }, [refetch]);

  const lastPunchAt = useRef<number>(0);
  const THROTTLE_MS = 5000;

  const syncOfflineQueue = useCallback(async () => {
    if (!userId || !companyId) return;
    const queue = OfflinePunchService.getQueue();
    if (!queue.length) return;

    const toSync = queue.filter(
      (item) => item.userId === userId && item.companyId === companyId
    );
    if (!toSync.length) return;

    const syncedIds: string[] = [];

    for (const item of toSync) {
      try {
        await PontoService.registerPunch(
          item.userId,
          item.companyId,
          item.type,
          item.method,
          item.data.location,
          item.data.photo,
          item.data.justification
        );
        syncedIds.push(item.id);
        // ✅ OTIMIZADO: Invalidar cache após sincronizar
        queryClient.invalidateQueries({ queryKey: ['records', userId] });
        invalidateAfterPunch(userId, companyId);
      } catch (err) {
        // Se falhar, mantém na fila para tentar depois
        console.warn('Falha ao sincronizar ponto offline, tentando novamente depois.', err);
      }
    }

    if (syncedIds.length) {
      OfflinePunchService.removeByIds(syncedIds);
    }
  }, [userId, companyId, queryClient]);

  const addRecord = async (type: LogType, method: PunchMethod, data: any) => {
    if (!userId || !companyId) return;
    const now = Date.now();
    if (now - lastPunchAt.current < THROTTLE_MS) {
      setError('Aguarde alguns segundos antes de registrar novamente.');
      return;
    }
    lastPunchAt.current = now;
    setError(null);
    try {
      const newRecord = await PontoService.registerPunch(
        userId,
        companyId,
        type,
        method,
        data.location,
        data.photo,
        data.justification
      );
      // ✅ OTIMIZADO: Invalidar cache após registrar ponto
      queryClient.invalidateQueries({ queryKey: ['records', userId] });
      invalidateAfterPunch(userId, companyId);
      return newRecord;
    } catch (err: any) {
      // Modo offline básico: se estiver sem conexão, enfileirar o registro
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        OfflinePunchService.enqueue(userId, companyId, type, method, {
          location: data.location,
          photo: data.photo,
          justification: data.justification,
        });
        setError('Sem conexão. Seu ponto foi salvo offline e será sincronizado depois.');
        return;
      }

      setError(err.message || 'Erro desconhecido ao registrar ponto.');
      throw err;
    }
  };

  // Sincronizar fila offline quando voltar a ficar online
  useEffect(() => {
    if (!userId || !companyId) return;

    // Tenta uma sincronização inicial
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncOfflineQueue();
    }

    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, companyId, syncOfflineQueue]);

  return { records, isLoading, error, setError, addRecord, refreshRecords };
};
