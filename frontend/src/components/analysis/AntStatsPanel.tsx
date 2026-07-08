'use client';

import { ExternalLink, BarChart2 } from 'lucide-react';

const ANT_URL = 'https://www.ant.gob.ec/estadisticas/';

export function AntStatsPanel() {
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
        <a
          href={ANT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground border border-border/50 hover:text-foreground hover:border-border transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Abrir
        </a>
      </div>

      <div className="flex-1 min-h-0">
        <iframe
          src={ANT_URL}
          title="Estadísticas de Siniestralidad Vial — ANT Ecuador"
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
