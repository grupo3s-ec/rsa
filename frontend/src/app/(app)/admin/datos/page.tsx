'use client';

import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { uploadAntSiniestros, type AntUploadResult } from '@/lib/api/ant-siniestros';
import { uploadRiskEvaluation, type RiskEvaluationUploadResult } from '@/lib/api/risk-evaluation';

type UploadState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string }
  | { status: 'success'; fileName: string; kind: 'ant'; result: AntUploadResult }
  | { status: 'success'; fileName: string; kind: 'risk'; result: RiskEvaluationUploadResult }
  | { status: 'error'; fileName: string; message: string };

/** Carga de archivos fuente que se actualizan periódicamente: BDD de
 * siniestros ANT (.xlsx mensual) y Evaluación de Riesgo por km (.ods) — antes
 * había que extraerlos a mano; esta pantalla sube el archivo tal cual y el
 * backend lo parsea directo. */
export default function DatosPage() {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [dragging, setDragging] = useState(false);
  const [evaluationName, setEvaluationName] = useState('Ruta FDN - Cuenca');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'xlsx') {
      setState({ status: 'loading', fileName: file.name });
      try {
        const result = await uploadAntSiniestros(file);
        setState({ status: 'success', fileName: file.name, kind: 'ant', result });
      } catch (err) {
        setState({ status: 'error', fileName: file.name, message: err instanceof Error ? err.message : 'Error al subir el archivo.' });
      }
      return;
    }

    if (ext === 'ods') {
      if (!evaluationName.trim()) {
        setState({ status: 'error', fileName: file.name, message: 'Escribe el nombre de la evaluación antes de subir el archivo.' });
        return;
      }
      setState({ status: 'loading', fileName: file.name });
      try {
        const result = await uploadRiskEvaluation(file, evaluationName.trim());
        setState({ status: 'success', fileName: file.name, kind: 'risk', result });
      } catch (err) {
        setState({ status: 'error', fileName: file.name, message: err instanceof Error ? err.message : 'Error al subir el archivo.' });
      }
      return;
    }

    setState({ status: 'error', fileName: file.name, message: 'Formato no reconocido — solo .xlsx (BDD ANT) o .ods (Evaluación de Riesgo).' });
  }, [evaluationName]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }, [handleFile]);

  const loading = state.status === 'loading';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Carga de datos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arrastra el archivo tal cual lo descargas — se procesa directo, sin extraerlo a mano.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="evaluation-name">Nombre de la evaluación (solo para archivos .ods)</Label>
        <Input
          id="evaluation-name"
          value={evaluationName}
          onChange={(e) => setEvaluationName(e.target.value)}
          placeholder="Ej. Ruta FDN - Cuenca"
        />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.ods"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        {loading ? (
          <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="size-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {loading ? `Procesando ${state.fileName}…` : 'Arrastra el archivo aquí, o haz clic para buscarlo'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            .xlsx → BDD de siniestros ANT (mensual) · .ods → Evaluación de Riesgo por km
          </p>
        </div>
      </div>

      {state.status === 'success' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-4 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">{state.fileName} cargado</p>
            {state.kind === 'ant' ? (
              <p className="mt-0.5 text-muted-foreground">
                {state.result.creados} creados, {state.result.actualizados} actualizados de {state.result.total} filas
                {state.result.omitidos > 0 ? ` (${state.result.omitidos} omitidos sin coordenadas)` : ''}.
              </p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">
                {state.result.kms} km cargados en &ldquo;{state.result.nombre}&rdquo;.
              </p>
            )}
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <CircleAlert className="size-5 shrink-0 text-destructive" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-destructive">No se pudo cargar {state.fileName}</p>
            <p className="mt-0.5 text-muted-foreground">{state.message}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground">
        <FileSpreadsheet className="size-4 shrink-0" />
        <p>
          Ambos formatos hacen <strong>upsert</strong>: subir un archivo actualizado no duplica filas, solo agrega
          lo nuevo y actualiza lo que cambió. El .xlsx de la ANT puede pesar 100+ MB y tardar varios minutos.
        </p>
      </div>
    </div>
  );
}
