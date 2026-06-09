import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Incident } from "@/types/incident";
import { SeverityBadge } from "@/components/incidents/SeverityBadge";

interface IncidentDetailDialogProps {
  incident: Incident | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatValue(value: string | number | null): string {
  if (value === null || value === "") {
    return "No disponible";
  }

  return String(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function IncidentDetailDialog({
  incident,
  open,
  onOpenChange,
}: IncidentDetailDialogProps) {
  if (!incident) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle>{incident.title}</DialogTitle>
              <DialogDescription>
                Detalle operativo del evento reportado.
              </DialogDescription>
            </div>
            <SeverityBadge severity={incident.severity} />
          </div>
        </DialogHeader>

        <Separator />

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="font-medium">{incident.type}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="font-medium">{incident.status}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Latitud</dt>
            <dd className="font-medium">{incident.latitude}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Longitud</dt>
            <dd className="font-medium">{incident.longitude}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Fuente</dt>
            <dd className="font-medium">{incident.source}</dd>
          </div>

          <div>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd className="font-medium">{formatDate(incident.occurred_at)}</dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Descripción</dt>
            <dd className="font-medium">{formatValue(incident.description)}</dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Video / referencia externa</dt>
            <dd className="break-all font-medium">
              {incident.video_url ? (
                <a
                  href={incident.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  {incident.video_url}
                </a>
              ) : (
                "No disponible"
              )}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
