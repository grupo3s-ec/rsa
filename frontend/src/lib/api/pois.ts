import { apiClient } from '@/lib/api/client';

export interface PoiPoint {
  name: string;
  lat: number;
  lng: number;
  address: string;
  tipo: 'Gasolinera' | 'UPC / Policía' | 'Hostal / Hotel' | string;
}

/** Gasolineras/UPC/hostales de Google Places cerca de los puntos dados
 * (muestreados de la ruta activa, ver `sampleEveryKm` en `@/lib/geo`). */
export function getPoisNearRoute(points: Array<{ lat: number; lng: number }>): Promise<PoiPoint[]> {
  return apiClient
    .post<{ pois: PoiPoint[] }, { points: Array<{ lat: number; lng: number }> }>(
      '/pois/nearby-route',
      { points },
      // Es un POST solo por el tamaño del payload (hasta 40 puntos) — en la
      // práctica es una consulta de lectura, segura de reintentar ante un
      // cold-start de Render (ver `idempotent` en apiClient).
      { idempotent: true },
    )
    .then((res) => res.pois);
}
