'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, PlatformRole } from '@aegis/shared';
import api from '@/lib/api';

interface AuthState {
  user: (User & { token: string }) | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresMfa: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setRequiresMfa: (requiresMfa: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      requiresMfa: false,
      login: (user, token) => set({ user: { ...user, token }, isAuthenticated: true, isLoading: false, requiresMfa: false }),
      logout: () => set({ user: null, isAuthenticated: false, isLoading: false, requiresMfa: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      setRequiresMfa: (requiresMfa) => set({ requiresMfa }),
    }),
    {
      name: 'aegis-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // After hydration, set loading to false so the UI can render
        if (state) {
          state.setLoading(false);
        }
      },
    }
  )
);

// Separate sync function to avoid circular reference inside store creation
export async function syncUserFromDatabase() {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser?.token) return;

  try {
    const response = await api.get('/auth/me');
    const freshUser = response.data.data.user;
    useAuthStore.setState({ user: { ...freshUser, token: currentUser.token } });
  } catch (error) {
    // If sync fails (e.g., token expired), logout
    console.error('User sync failed:', error);
    useAuthStore.getState().logout();
  }
}

export function getDashboardRoute(role: PlatformRole): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'assessor':
      return '/assessor/dashboard';
    default:
      return '/';
  }
}
