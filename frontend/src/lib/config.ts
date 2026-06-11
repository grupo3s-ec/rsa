/**
 * Configuración pública del cliente.
 *
 * Las variables `NEXT_PUBLIC_*` se inlinan en el bundle del navegador en build time,
 * por lo que se leen de forma estática (no usar acceso dinámico por índice).
 */

/** Token público de Mapbox (pk.*). Vacío hasta que se configure en `.env.local`. */
export const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

/** Indica si hay un token de Mapbox configurado. */
export const IS_MAPBOX_CONFIGURED: boolean = MAPBOX_TOKEN.length > 0;
