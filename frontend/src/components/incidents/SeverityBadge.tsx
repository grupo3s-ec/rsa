import { Badge } from "@/components/ui/badge";
import type { IncidentSeverity } from "@/types/incident";

interface SeverityBadgeProps {
  severity: IncidentSeverity;
}

const severityLabels: Record<IncidentSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const severityClassNames: Record<IncidentSeverity, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={severityClassNames[severity]}
    >
      {severityLabels[severity]}
    </Badge>
  );
}
