'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ANT_URL = 'https://app.powerbi.com/view?r=eyJrIjoiMTJjMjUyZjQtNDMzZS00NmViLThiY2UtZDQwMDk2ZjYwMTFhIiwidCI6IjMwMGM3OTYyLTRmMzYtNDA5ZC04NDc0LTc2ZjRkNTBkZDI5ZiIsImMiOjR9&pageName=ReportSection97a60f7c854f06ea5bb5';

interface AntReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Reporte Power BI de siniestralidad vial (ANT Ecuador) — se abre desde el
 * botón flotante siempre visible sobre el mapa (`RoutePlanner`), no desde
 * ninguna pestaña: el ancho angosto del panel lateral lo hacía ilegible. */
export function AntReportDialog({ open, onOpenChange }: AntReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Sin altura fija (antes h-[85vh] dejaba mucho espacio en blanco
          debajo del reporte, que no se estira para llenar el contenedor) —
          el iframe vive en una caja con el aspecto real del reporte, y el
          diálogo se ajusta a eso en vez de forzar una caja más grande. */}
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Siniestralidad Vial · ANT Ecuador</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={ANT_URL}
            title="Estadísticas de Siniestralidad Vial — ANT Ecuador"
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
