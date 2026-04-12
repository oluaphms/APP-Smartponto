/**
 * Re-export de supabase para compatibilidade com código existente
 * Todos os imports devem vir daqui
 */

export { 
  supabase, 
  isSupabaseConfigured, 
  getUserProfileStorage, 
  clearCurrentUserFromAllStorages, 
  useSessionStorageForAuth,
  DB_SELECT_TIMEOUT_MS,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  clearLocalAuthSession
} from './supabase';
export { getSupabaseClient, getSupabaseClientOrThrow, testSupabaseConnection, withSupabaseTimeout, resetSession } from '../src/lib/supabaseClient';

// Criar aliases para db e storage (compatibilidade com código antigo)
import { getSupabaseClient } from '../src/lib/supabaseClient';

export const db = {
  select: (table: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.from(table).select();
  },
  insert: (table: string, data: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.from(table).insert(data);
  },
  update: (table: string, data: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.from(table).update(data);
  },
  delete: (table: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.from(table).delete();
  },
};

export const storage = {
  from: (bucket: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.storage.from(bucket);
  },
};

export const auth = {
  signUp: async (email: string, password: string, options?: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { data, error } = await client.auth.signUp({ email, password, options });
    if (error) throw error;
    return data;
  },
  /** Alias de signInWithPassword para compatibilidade com authService */
  signIn: async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  signInWithPassword: async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  signInWithOAuth: async (provider: string, options?: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { data, error } = await client.auth.signInWithOAuth({ provider: provider as any, ...options });
    if (error) throw error;
    return data;
  },
  signOut: async (options?: { scope?: 'global' | 'local' | 'others' }) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.auth.signOut(options);
  },
  getSession: async () => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.auth.getSession();
  },
  getUser: async () => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.auth.getUser();
  },
  updatePassword: async (newPassword: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
  resetPassword: async (email: string, redirectTo?: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    if (error) throw error;
  },
  onAuthStateChange: (callback: any) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não inicializado');
    return client.auth.onAuthStateChange(callback);
  },
};
