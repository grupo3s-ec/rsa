'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { IncidentCreateDialog } from './IncidentCreateDialog';

interface IncidentFabProps {
  onCreated?: () => void;
}

export function IncidentFab({ onCreated }: IncidentFabProps = {}) {
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
      <IncidentCreateDialog open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  );
}
