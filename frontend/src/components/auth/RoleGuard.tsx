'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { LoaderCircle } from 'lucide-react';
import type { UserRole } from '@/types/auth';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, redirectTo = '/mapa', children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = !!user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!allowed) router.replace(redirectTo);
  }, [loading, user, allowed, redirectTo, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
