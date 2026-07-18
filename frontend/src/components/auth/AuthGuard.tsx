'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, warming } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
        {warming && (
          <p className="text-xs text-muted-foreground">Conectando con el servidor…</p>
        )}
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Aviso no bloqueante — el servidor (Render free tier) puede tardar
          hasta 1 minuto en despertar tras estar inactivo. Sin esto, una
          página que tarda en cargar sus datos se ve igual a una rota. */}
      {warming && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border/40 bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          <LoaderCircle className="size-3 animate-spin" />
          Conectando con el servidor — puede tardar hasta un minuto la primera vez
        </div>
      )}
      {children}
    </>
  );
}
