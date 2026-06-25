'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { IncidentCreateDialog } from './IncidentCreateDialog';

export function IncidentFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Reportar novedad"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-6" />
      </button>
      <IncidentCreateDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
