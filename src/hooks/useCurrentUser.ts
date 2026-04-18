import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export interface User {
  id: string;
  email?: string;
  nome?: string;
  role: 'admin' | 'hr' | 'employee';
  company_id?: string;
  department_id?: string;
}

let cachedUser: User | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export function readCachedUser(): User | null {
  if (cachedUser && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedUser;
  }
  return null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingProfileRef = useRef(false);

  const loadUser = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (loadingProfileRef.current) return;
    loadingProfileRef.current = true;
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        setUser(null);
        cachedUser = null;
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profile) {
        setUser(null);
        cachedUser = null;
      } else {
        setUser(profile as User);
        cachedUser = profile as User;
        cacheTimestamp = Date.now();
      }
    } catch {
      setUser(null);
      cachedUser = null;
    } finally {
      loadingProfileRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION já coberto pelo loadUser() acima — evita 2× getSession + 2× select em users
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        cachedUser = null;
        setLoading(false);
        return;
      }
      if (session?.user) {
        void loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  return { user, loading, refresh: loadUser };
}

export default useCurrentUser;
