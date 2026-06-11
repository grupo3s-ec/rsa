import { Badge } from "@/components/ui/badge";
import { severityMeta } from "@/lib/incidents/format";
import { cn } from "@/lib/utils";
import type { IncidentSeverity } from "@/types/incident";

interface SeverityBadgeProps {
  severity: IncidentSeverity;
  className?: string;
}

/**
 * Chip minimalista de severidad: punto de color + etiqueta corta.
 * Consume `severityMeta` como única fuente de colores.
 */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const meta = severityMeta[severity];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 bg-background/70", meta.textClass, className)}
    >
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </Badge>
  );
}
