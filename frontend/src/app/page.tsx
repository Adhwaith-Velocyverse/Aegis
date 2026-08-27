'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/components/LoginPage';
import Dashboard from '@/components/Dashboard';

// getDashboardRoute is no longer used — all roles land on /
// Kept here for reference if needed in future
function getDashboardRoute(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'assessor':
      return '/assessor/dashboard';
    default:
      return '/';
  }
}

export default function Home() {
  const { isAuthenticated, isLoading, user, requiresMfa } = useAuthStore();
  const router = useRouter();
  const [showFallback, setShowFallback] = useState(false);

  // Fallback: if loading takes more than 3 seconds, show the app anyway
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Handle MFA requirement
  useEffect(() => {
    if (isAuthenticated && requiresMfa && user) {
      router.push('/mfa');
    }
  }, [isAuthenticated, requiresMfa, user, router]);

  // No role-based redirect — all users land on the main dashboard at /
  // The Dashboard component handles showing appropriate content per role

  if (isLoading && !showFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (requiresMfa) {
    return null; // Will redirect to MFA page
  }

  return <Dashboard />;
}

