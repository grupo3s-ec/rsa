/**
 * Single source of truth para las señales visuales de incidentes:
 * colores por severidad, iconos por tipo, etiquetas de estado y
 * formateadores de presentación (duración, distancia, fechas, video).
 */

import {
  Ban,
  CarFront,
  Construction,
  LifeBuoy,
  Mountain,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from "@/types/incident";

interface SeverityMeta {
  /** Etiqueta corta en español. */
  label: string;
  /** Color sólido para marcadores en Mapbox. */
  hex: string;
  /** Punto de color para chips/listas. */
  dotClass: string;
  /** Color de texto asociado. */
  textClass: string;
  /** Anillo de resaltado para el item seleccionado. */
  ring: string;
}

export const severityMeta: Record<IncidentSeverity, SeverityMeta> = {
  low: {
    label: "Baja",
    hex: "#10b981",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/60",
  },
  medium: {
    label: "Media",
    hex: "#f59e0b",
    dotClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/60",
  },
  high: {
    label: "Alta",
    hex: "#f97316",
    dotClass: "bg-orange-500",
    textClass: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/60",
  },
  critical: {
    label: "Crítica",
    hex: "#ef4444",
    dotClass: "bg-red-500",
    textClass: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/60",
  },
};

interface TypeMeta {
  label: string;
  icon: LucideIcon;
}

export const typeMeta: Record<IncidentType, TypeMeta> = {
  accident: { label: "Siniestro", icon: CarFront },
  road_damage: { label: "Daño en vía", icon: Construction },
  landslide: { label: "Derrumbe", icon: Mountain },
  closure: { label: "Cierre", icon: Ban },
  risk: { label: "Riesgo", icon: TriangleAlert },
  checkpoint: { label: "Control", icon: ShieldCheck },
  assistance: { label: "Asistencia", icon: LifeBuoy },
};

export const statusMeta: Record<IncidentStatus, { label: string }> = {
  open: { label: "Abierto" },
  in_progress: { label: "En proceso" },
  resolved: { label: "Resuelto" },
  archived: { label: "Archivado" },
};

export interface EmbedUrl {
  kind: "drive" | "external" | "none";
  url: string | null;
}

/**
 * Convierte un link de Google Drive (`.../file/d/{ID}/view`) en su
 * versión embebible (`.../file/d/{ID}/preview`). Otros links se
 * clasifican como externos; null/"" como inexistentes.
 */
export function toEmbedUrl(videoUrl: string | null): EmbedUrl {
  if (!videoUrl) {
    return { kind: "none", url: null };
  }

  const driveMatch = videoUrl.match(
    /drive\.google\.com\/file\/d\/([\w-]+)/,
  );

  if (driveMatch) {
    return {
      kind: "drive",
      url: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  return { kind: "external", url: videoUrl };
}

/** "12 min" / "1 h 5 min". */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

/** "8.4 km" / "640 m". */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

/** Fecha legible en es-EC, o "—" si no hay valor. */
export function formatDateEs(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
