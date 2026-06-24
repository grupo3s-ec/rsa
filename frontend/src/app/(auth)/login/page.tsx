'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/context';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch|network|failed/i.test((err as Error).message);
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [remember,   setRemember]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [warming,    setWarming]    = useState(false);

  // Despierta el backend de Render (free tier duerme a los 15 min)
  useEffect(() => {
    let cancelled = false;
    setWarming(true);
    fetch(`${API_BASE}/up`, { method: 'GET', signal: AbortSignal.timeout(45_000) })
      .catch(() => { /* silencioso — solo warmup */ })
      .finally(() => { if (!cancelled) setWarming(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace('/mapa');
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password, remember);
      router.replace('/mapa');
    } catch (err) {
      if (isNetworkError(err)) {
        // Reintenta una vez si fue error de red (ej. Render despertando)
        try {
          await new Promise(r => setTimeout(r, 3000));
          await login(email, password, remember);
          router.replace('/mapa');
          return;
        } catch (retryErr) {
          setError(
            isNetworkError(retryErr)
              ? 'No se pudo conectar al servidor. Inténtalo en unos segundos.'
              : (retryErr instanceof Error ? retryErr.message : 'Error al iniciar sesión.'),
          );
        }
      } else {
        setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo RSA */}
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <Image
          src="/rsa-logo.jpeg"
          alt="RSA — Route Safety Analysis by Grupo3S"
          width={220}
          height={66}
          priority
          className="h-auto w-[200px]"
        />
        <p className="text-xs text-muted-foreground">Plataforma interna · Grupo3S</p>
      </div>

      {/* Formulario */}
      <div className="rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="usuario@empresa.ec"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={submitting}
              className="size-4 rounded border-border accent-primary"
            />
            <span className="text-sm text-muted-foreground">Recuérdame por 30 días</span>
          </label>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting || warming}>
            {(submitting || warming) ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : null}
            {submitting ? 'Ingresando…' : warming ? 'Conectando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
