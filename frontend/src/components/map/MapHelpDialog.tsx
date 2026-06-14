"use client";

import {
  Crosshair,
  Flag,
  Keyboard,
  MapPin,
  MousePointer2,
  Navigation,
  TriangleAlert,
  ZoomIn,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MapHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HelpSection {
  title: string;
  icon: React.ReactNode;
  items: { keys?: string[]; label: string }[];
}

const SECTIONS: HelpSection[] = [
  {
    title: "Controles del mapa",
    icon: <MousePointer2 className="size-4" />,
    items: [
      { keys: ["Scroll"], label: "Acercar o alejar" },
      { keys: ["Click + arrastrar"], label: "Mover el mapa" },
      { keys: ["Ctrl", "Scroll"], label: "Rotar la vista" },
      { keys: ["Doble click"], label: "Acercar al punto" },
    ],
  },
  {
    title: "Atajos de teclado",
    icon: <Keyboard className="size-4" />,
    items: [
      { keys: ["Enter"], label: "Ver ruta y alertas" },
      { keys: ["Esc"], label: "Cancelar selección en mapa" },
      { keys: ["R"], label: "Reportar incidente" },
      { keys: ["A"], label: "Mostrar / ocultar alertas" },
      { keys: ["←", "→"], label: "Navegar entre incidentes" },
    ],
  },
  {
    title: "Flujo de uso",
    icon: <Navigation className="size-4" />,
    items: [
      {
        label:
          "Elige tu punto de salida desde los lugares frecuentes o toca «Tocar mapa».",
      },
      {
        label:
          "Elige tu destino de la misma forma.",
      },
      {
        label:
          "Presiona «Ver ruta y alertas» — el sistema calculará la mejor ruta y mostrará solo los incidentes que estén en tu camino.",
      },
      {
        label:
          "Toca cualquier incidente en el mapa o en la lista para ver sus detalles.",
      },
    ],
  },
  {
    title: "Íconos y colores",
    icon: <MapPin className="size-4" />,
    items: [
      { label: "🟢 Verde · Severidad baja — toma precaución" },
      { label: "🟡 Amarillo · Severidad media — reduce velocidad" },
      { label: "🟠 Naranja · Severidad alta — desvío recomendado" },
      { label: "🔴 Rojo parpadeante · Crítico — evita la zona" },
    ],
  },
];

export function MapHelpDialog({ open, onOpenChange }: MapHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TriangleAlert className="size-4" />
            </span>
            Guía de uso — RSA Mapa
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.icon}
                {section.title}
              </div>
              <ul className="space-y-1.5">
                {section.items.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-sm text-foreground/80"
                  >
                    {item.keys ? (
                      <span className="flex shrink-0 flex-wrap gap-1">
                        {item.keys.map((key) => (
                          <kbd
                            key={key}
                            className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-foreground"
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                    ) : (
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      </span>
                    )}
                    <span className="leading-snug">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Leyenda de íconos de tipo */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Flag className="size-4" />
              Tipos de incidente
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { emoji: "🚗", label: "Siniestro vial" },
                { emoji: "🚧", label: "Daño en vía" },
                { emoji: "⛰️", label: "Derrumbe" },
                { emoji: "🚫", label: "Cierre de vía" },
                { emoji: "⚠️", label: "Riesgo" },
                { emoji: "🛡️", label: "Control / Retén" },
                { emoji: "🆘", label: "Asistencia" },
              ].map(({ emoji, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs">
                  <span>{emoji}</span>
                  <span className="text-foreground/70">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Crosshair className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Los incidentes mostrados son{" "}
                <span className="font-medium text-foreground/70">
                  solo los que están en tu ruta
                </span>
                , calculados sobre la geometría real del trayecto — no todo lo
                que hay en la zona.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
