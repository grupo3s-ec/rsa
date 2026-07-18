'use client';

import { useState } from 'react';
import { ExternalLink, BarChart2, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const ANT_URL = 'https://app.powerbi.com/view?r=eyJrIjoiMTJjMjUyZjQtNDMzZS00NmViLThiY2UtZDQwMDk2ZjYwMTFhIiwidCI6IjMwMGM3OTYyLTRmMzYtNDA5ZC04NDc0LTc2ZjRkNTBkZDI5ZiIsImMiOjR9&pageName=ReportSection97a60f7c854f06ea5bb5';

/** El reporte Power BI es ilegible en el ancho angosto del panel lateral
 * (~300px) — en vez de forzar el iframe ahí, se muestra una vista previa
 * compacta con un botón que abre el reporte completo en un diálogo grande. */
export function AntStatsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full flex-col bg-background">
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

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-navy)]/10 text-[var(--brand-navy)] dark:text-[var(--brand-cyan)]">
          <BarChart2 className="size-6" />
        </span>
        <p className="text-xs text-muted-foreground">
          Este reporte necesita más espacio del que da este panel.
        </p>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Maximize2 className="size-3.5" />
          Ver reporte completo
        </Button>
        <a
          href={ANT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3" />
          Abrir en pestaña nueva
        </a>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Siniestralidad Vial · ANT Ecuador</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <iframe
              src={ANT_URL}
              title="Estadísticas de Siniestralidad Vial — ANT Ecuador"
              className="w-full h-full rounded-lg border-0"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
