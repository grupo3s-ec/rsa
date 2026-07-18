"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * Variante lateral de `Dialog` — mismo primitivo de `@base-ui/react/dialog`
 * (focus-trap/overlay/portal ya resueltos ahí), solo cambia la posición y
 * animación del `Popup`: se desliza desde el borde derecho en vez de
 * aparecer centrado, dejando el mapa visible/atenuado detrás del overlay
 * semi-transparente — mantiene el contexto espacial del usuario en vez de
 * taparlo por completo con un modal centrado.
 */

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const sheetSideClasses = {
  right: "inset-y-0 right-0 h-full w-full max-w-[calc(100%-2rem)] border-l sm:max-w-md data-open:slide-in-from-right data-closed:slide-out-to-right",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-[min(var(--radius-4xl),24px)] border-t data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
  top: "inset-x-0 top-0 max-h-[85vh] w-full rounded-b-[min(var(--radius-4xl),24px)] border-b data-open:slide-in-from-top data-closed:slide-out-to-top",
} as const

function SheetContent({
  className,
  children,
  showCloseButton = true,
  side = "right",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** Borde desde donde se desliza — "right" (por defecto, detalle/formularios
   * largos) o "bottom"/"top" (acciones rápidas tipo "reportar", no compite
   * por espacio con paneles laterales ya abiertos). */
  side?: keyof typeof sheetSideClasses
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-6 border-border/60 bg-popover p-6 text-sm text-popover-foreground shadow-xl outline-none duration-200 data-open:animate-in data-closed:animate-out",
          sheetSideClasses[side],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4 bg-secondary"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 space-y-5 overflow-y-auto", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetBody,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
