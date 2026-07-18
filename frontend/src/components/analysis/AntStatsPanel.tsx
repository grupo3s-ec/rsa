'use client';

import { useState } from 'react';
import { BarChart2, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ANT_URL = 'https://app.powerbi.com/view?r=eyJrIjoiMTJjMjUyZjQtNDMzZS00NmViLThiY2UtZDQwMDk2ZjYwMTFhIiwidCI6IjMwMGM3OTYyLTRmMzYtNDA5ZC04NDc0LTc2ZjRkNTBkZDI5ZiIsImMiOjR9&pageName=ReportSection97a60f7c854f06ea5bb5';

/** El reporte Power BI es ilegible en el ancho angosto del panel lateral
 * (~300px) — no se abre solo (interrumpiría al entrar al tab); un botón
 * flotante (mismo patrón que `IncidentFab`) lo abre en un diálogo grande
 * cuando el usuario lo pide. */
export function AntStatsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="size-4 text-[var(--brand-navy)] dark:text-[var(--brand-cyan)]" />
            Siniestralidad Vial · ANT Ecuador
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Estadísticas oficiales — Agencia Nacional de Tránsito
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground/60">
        <BarChart2 className="size-8" />
        <p className="text-xs">Este reporte necesita más espacio del que da este panel.</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ver reporte completo"
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2.5 text-xs font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Maximize2 className="size-3.5" />
        Ver reporte
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Sin altura fija (antes h-[85vh] dejaba mucho espacio en blanco
            debajo del reporte, que no se estira para llenar el contenedor) —
            el iframe vive en una caja con el aspecto real del reporte, y el
            diálogo se ajusta a eso en vez de forzar una caja más grande. */}
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Siniestralidad Vial · ANT Ecuador</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full overflow-hidden rounded-lg">
            <iframe
              src={ANT_URL}
              title="Estadísticas de Siniestralidad Vial — ANT Ecuador"
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
