import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin, VideoOff } from "lucide-react";
import { SeverityBadge } from "@/components/incidents/SeverityBadge";
import {
  formatDateEs,
  severityMeta,
  statusMeta,
  toEmbedUrl,
  typeMeta,
} from "@/lib/incidents/format";
import type { Incident, IncidentSource } from "@/types/incident";

interface IncidentDetailDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sourceLabels: Record<IncidentSource, string> = {
  manual: "Reporte manual",
  google_drive: "Google Drive",
  geotab: "Geotab",
};

/** Sección de video: iframe de Drive, link externo o placeholder sutil. */
function VideoSection({ videoUrl, title }: { videoUrl: string | null; title: string }) {
  const embed = toEmbedUrl(videoUrl);

  if (embed.kind === "drive" && embed.url) {
    return (
      <iframe
        src={embed.url}
        title={`Video: ${title}`}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="aspect-video w-full rounded-xl border border-border/60 bg-muted"
      />
    );
  }

  if (embed.kind === "external" && embed.url) {
    return (
      <Button
        variant="outline"
        className="w-full"
        nativeButton={false}
        render={
          <a href={embed.url} target="_blank" rel="noreferrer" />
        }
      >
        <ExternalLink data-icon="inline-start" />
        Ver referencia externa
      </Button>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/40 text-muted-foreground">
      <span className="flex items-center gap-2 text-xs">
        <VideoOff className="size-4" />
        Sin video
      </span>
    </div>
  );
}

/**
 * Detalle de incidente: jerarquía visual fuerte (icono + color de severidad)
 * y datos mínimos, con video embebido cuando existe.
 */
export function IncidentDetailDialog({
  incident,
  open,
  onOpenChange,
}: IncidentDetailDialogProps) {
  if (!incident) {
    return null;
  }

  const severity = severityMeta[incident.severity];
  const type = typeMeta[incident.type];
  const TypeIcon = type.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            {/* Icono del tipo en círculo con el color de la severidad. */}
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: severity.hex }}
            >
              <TypeIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle className="leading-snug">{incident.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={incident.severity} />
                <span className="text-xs">{type.label}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <VideoSection videoUrl={incident.video_url} title={incident.title} />

        {incident.description ? (
          <p className="text-sm leading-relaxed text-foreground/90">
            {incident.description}
          </p>
        ) : null}

        <Separator />

        {/* Meta mínima: estado por color, fuente, fecha y coordenadas. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={
                incident.status === "resolved" || incident.status === "archived"
                  ? "size-1.5 rounded-full bg-muted-foreground/50"
                  : "size-1.5 rounded-full bg-emerald-500"
              }
            />
            {statusMeta[incident.status].label}
          </span>

          <span>{sourceLabels[incident.source]}</span>

          <span>{formatDateEs(incident.occurred_at)}</span>

          <span className="flex items-center gap-1 font-mono">
            <MapPin className="size-3" />
            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
