'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CircleAlert,
  Database,
  LoaderCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  getGeotabStatus,
  getGeotabDevices,
  syncGeotab,
  type GeotabDevice,
  type GeotabStatus,
  type GeotabSyncResult,
} from '@/lib/api/geotab';

/** Retorna la fecha en formato YYYY-MM-DD desplazada N días desde hoy. */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function GeotabPage() {
  const [status, setStatus]       = useState<GeotabStatus | null>(null);
  const [devices, setDevices]     = useState<GeotabDevice[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [fromDate, setFromDate]   = useState(offsetDate(-7));
  const [toDate, setToDate]       = useState(offsetDate(0));
  const [deviceId, setDeviceId]   = useState<string>('');
  const [syncing, setSyncing]     = useState(false);
  const [syncResult, setSyncResult] = useState<GeotabSyncResult | null>(null);
  const [syncError, setSyncError]   = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await getGeotabStatus();
      setStatus(s);

      if (s.configured && s.connected) {
        setLoadingDevices(true);
        try {
          const devs = await getGeotabDevices();
          setDevices(devs);
        } catch {
          // dispositivos no críticos — no bloqueamos la UI
        } finally {
          setLoadingDevices(false);
        }
      }
    } catch {
      setStatus({ configured: false, message: 'No se pudo verificar el estado de Geotab.' });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleSync(e: React.FormEvent) {
    e.preventDefault();
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);

    try {
      const result = await syncGeotab({
        from_date: fromDate,
        to_date: toDate,
        device_id: deviceId || null,
      });
      setSyncResult(result);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Error al sincronizar.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Geotab</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadStatus}
            disabled={loadingStatus}
            className="text-muted-foreground"
          >
            <RefreshCw className={cn('size-3.5', loadingStatus && 'animate-spin')} />
            Actualizar
          </Button>
        </header>

        {/* Estado de conexión */}
        <div className="mt-6">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Verificando conexión…
            </div>
          ) : status ? (
            <StatusCard status={status} />
          ) : null}
        </div>

        {/* Formulario de sincronización — solo si está conectado */}
        {status?.configured && status?.connected ? (
          <form onSubmit={handleSync} className="mt-8 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight">Importar eventos</h2>
              <p className="text-sm text-muted-foreground">
                Sincroniza ExceptionEvents de Geotab como incidentes en RSA.
                Los eventos ya importados se omiten automáticamente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="from-date">Desde</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to-date">Hasta</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Selector de dispositivo */}
            <div className="space-y-1.5">
              <Label htmlFor="device">
                Dispositivo
                <span className="font-normal text-muted-foreground"> · opcional</span>
              </Label>
              {loadingDevices ? (
                <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Cargando dispositivos…
                </div>
              ) : devices.length > 0 ? (
                <select
                  id="device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Todos los dispositivos</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.licensePlate ? ` · ${d.licensePlate}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="device"
                  placeholder="ID de dispositivo Geotab (opcional)"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                />
              )}
            </div>

            {/* Resultado anterior */}
            {syncResult ? (
              <SyncResult result={syncResult} />
            ) : null}
            {syncError ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>{syncError}</AlertTitle>
              </Alert>
            ) : null}

            <Button type="submit" disabled={syncing} className="w-full">
              {syncing ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              {syncing ? 'Sincronizando…' : 'Sincronizar eventos'}
            </Button>
          </form>
        ) : null}

        {/* Instrucciones si no está configurado */}
        {status && !status.configured ? (
          <div className="mt-8 rounded-2xl border border-border/60 bg-muted/30 p-5 text-sm">
            <p className="font-medium">Configuración requerida</p>
            <p className="mt-1 text-muted-foreground">
              Agrega las siguientes variables al archivo <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">backend/.env</code>:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs text-foreground">
{`GEOTAB_SERVER=my.geotab.com
GEOTAB_USERNAME=riestrella95@gmail.com
GEOTAB_PASSWORD=tu_contraseña
GEOTAB_DATABASE=lab_siegfried`}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusCard({ status }: { status: GeotabStatus }) {
  if (!status.configured) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/40 dark:bg-amber-950/20">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-amber-800 dark:text-amber-300">
          Credenciales no configuradas
        </span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-800/40 dark:bg-emerald-950/20">
        <Wifi className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="text-emerald-800 dark:text-emerald-300">
          Conectado a Geotab · <span className="font-mono">lab_siegfried</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-800/40 dark:bg-red-950/20">
      <WifiOff className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
      <div>
        <span className="font-medium text-red-800 dark:text-red-300">Error de conexión</span>
        {status.error ? (
          <p className="mt-0.5 text-red-700/80 dark:text-red-400/80">{status.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function SyncResult({ result }: { result: GeotabSyncResult }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="size-4" />
        Sincronización completada
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 text-center">
        <Stat label="Eventos Geotab" value={result.events_found} />
        <Stat label="Importados" value={result.created} highlight />
        <Stat label="Ya existían" value={result.skipped} muted />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, muted }: { label: string; value: number; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className={cn(
        'text-2xl font-semibold tabular-nums',
        highlight ? 'text-emerald-700 dark:text-emerald-400'
          : muted ? 'text-muted-foreground'
          : 'text-foreground',
      )}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
