'use client';

import { useEffect } from 'react';
import { useAuthStore, syncUserFromDatabase } from '@/stores/authStore';

export default function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      syncUserFromDatabase();
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}
