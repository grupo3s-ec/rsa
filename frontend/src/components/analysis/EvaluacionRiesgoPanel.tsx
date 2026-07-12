'use client';

import { useState } from 'react';
import { ExternalLink, LoaderCircle, ShieldCheck } from 'lucide-react';

// Enlace de compartir (botón Abrir)
const FILE_URL =
  'https://logexec0-my.sharepoint.com/:x:/r/personal/juan_jara_logex_ec/Documents/Evaluaci%C3%B3n%20de%20Riesgo%20Ruta%20FDN%20-%20Cuenca.xlsx?d=w608be1f1f6c94e8fbfeed67435613dff&csf=1&web=1&e=cuUVhb';

// Visor embebido de SharePoint — no redirige a login.microsoftonline.com
const EMBED_URL =
  'https://logexec0-my.sharepoint.com/personal/juan_jara_logex_ec/_layouts/15/Doc.aspx' +
  '?sourcedoc=%7B608be1f1-f6c9-4e8f-bfee-d67435613dff%7D' +
  '&action=embedview&wdAllowInteractivity=False&wdDownloadButton=True';

export function EvaluacionRiesgoPanel() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            Evaluación de Riesgo de Ruta
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Evaluación de Riesgo Ruta FDN — Cuenca
          </p>
        </div>
        <a
          href={FILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground border border-border/50 hover:text-foreground hover:border-border transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Abrir
        </a>
      </div>

      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <iframe
          src={EMBED_URL}
          title="Evaluación de Riesgo de Ruta FDN — Cuenca"
          className="w-full h-full border-0"
          allowFullScreen
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
