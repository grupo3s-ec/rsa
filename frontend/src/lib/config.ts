/**
 * Configuración pública del cliente.
 *
 * Las variables `NEXT_PUBLIC_*` se inlinan en el bundle del navegador en build time.
 */

export const GOOGLE_MAPS_API_KEY: string =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
