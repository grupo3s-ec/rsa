'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function MapaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/mapa error boundary]', error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Error al cargar el mapa</p>
        <p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">{error.digest}</p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        <RefreshCw className="size-4" />
        Reintentar
      </button>
    </div>
  );
}
