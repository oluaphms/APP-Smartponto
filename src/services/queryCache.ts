/**
 * Cache em memória para queries do Supabase.
 * Evita re-fetches desnecessários ao navegar entre páginas.
 * Sem dependências externas — substitui React Query para os casos mais comuns.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** TTLs padrão por tipo de dado (ms) */
export const TTL = {
  /** Dados que mudam raramente: departamentos, cargos, escalas */
  STATIC: 5 * 60 * 1000,       // 5 min
  /** Dados que mudam com frequência moderada: funcionários, configurações */
  NORMAL: 60 * 1000,            // 1 min
  /** Dados em tempo real: registros de ponto, badges */
  REALTIME: 15 * 1000,          // 15 s
} as const;

export const queryCache = {
  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.data;
  },

  set<T>(key: string, data: T, ttl: number): void {
    store.set(key, { data, expiresAt: Date.now() + ttl });
  },

  /**
   * Busca do cache ou executa o fetcher e armazena o resultado.
   * Deduplicação: chamadas simultâneas com a mesma key compartilham a mesma promise.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    // Deduplicação de chamadas em voo
    const inflight = inflightMap.get(key) as Promise<T> | undefined;
    if (inflight) return inflight;

    const promise = fetcher().then((data) => {
      this.set(key, data, ttl);
      inflightMap.delete(key);
      return data;
    }).catch((err) => {
      inflightMap.delete(key);
      throw err;
    });

    inflightMap.set(key, promise);
    return promise;
  },

  /** Invalida entradas que começam com o prefixo (ex: 'users:company123') */
  invalidate(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /** Limpa todo o cache (ex: no logout) */
  clear(): void {
    store.clear();
    inflightMap.clear();
  },
};

const inflightMap = new Map<string, Promise<unknown>>();
