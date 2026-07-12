'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { IncidentCreateDialog } from './IncidentCreateDialog';
import type { LngLat } from '@/lib/mapbox/directions';

interface IncidentFabProps {
  onCreated?: () => void;
  /** Pide al padre activar el modo "click en el mapa" para marcar la ubicación. */
  onRequestPickLocation?: () => void;
  /** true mientras el padre está esperando un click en el mapa. */
  pickActive?: boolean;
  /** Coordenadas resultantes de ese modo, o null si no hay ninguna pendiente. */
  pickedCoords?: LngLat | null;
  /** Confirma al padre que ya se consumieron `pickedCoords`. */
  onPickedCoordsConsumed?: () => void;
}

export function IncidentFab({ onCreated, onRequestPickLocation, pickActive, pickedCoords, onPickedCoordsConsumed }: IncidentFabProps = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Reportar incidente"
        onClick={() => setOpen(true)}
        className="absolute bottom-6 left-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TriangleAlert className="size-5 shrink-0" />
        <span className="text-sm font-medium">Reportar incidente</span>
      </button>
      <IncidentCreateDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={onCreated}
        onRequestPickLocation={onRequestPickLocation}
        pickActive={pickActive}
        pickedCoords={pickedCoords ?? null}
        onPickedCoordsConsumed={onPickedCoordsConsumed}
      />
    </>
  );
}
