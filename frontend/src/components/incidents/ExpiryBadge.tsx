import { Badge } from "@/components/ui/badge";
import { getExpiryState } from "@/lib/incidents/expiry";
import { cn } from "@/lib/utils";
import type { IncidentStatus } from "@/types/incident";
import { AlertTriangle, Clock } from "lucide-react";

interface ExpiryBadgeProps {
  expiresAt: string | null;
  status: IncidentStatus;
  className?: string;
}

/**
 * Aviso de vencimiento — visible para cualquier usuario. No reemplaza a
 * SeverityBadge, se muestra junto a él: uno indica QUÉ tan grave es, este
 * indica si YA TOCA darle seguimiento.
 */
export function ExpiryBadge({ expiresAt, status, className }: ExpiryBadgeProps) {
  const state = getExpiryState(expiresAt, status);
  if (!state) return null;

  const isExpired = state === "expired";
  const Icon = isExpired ? AlertTriangle : Clock;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 bg-background/70",
        isExpired
          ? "border-red-500/40 text-red-600 dark:text-red-400"
          : "border-amber-500/40 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <Icon className="size-3" />
      {isExpired ? "Necesita seguimiento" : "Por caducar"}
    </Badge>
  );
}
