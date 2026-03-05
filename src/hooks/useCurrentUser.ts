import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import { User } from '../../types';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const u = await authService.getCurrentUser();
        if (mounted) setUser(u);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}

