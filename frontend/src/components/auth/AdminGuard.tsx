'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { LoaderCircle } from 'lucide-react';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'admin') router.replace('/mapa');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user.role !== 'admin') return null;

  return <>{children}</>;
}
