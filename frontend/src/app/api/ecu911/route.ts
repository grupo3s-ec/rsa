import { NextResponse } from 'next/server';
import type { Ecu911Response } from '@/types/ecu911';

export const runtime = 'edge';

// Excluye estado_actual_id=593 (HABILITADA) → solo devuelve vías con problemas
const ECU911_URL =
  'https://ecu911.gob.ec/Services/WSVias/ViasWeb.php' +
  '?estado=A&and:%3C%3E:EstadoActual-id=593&order=Provincia-descripcion&limit=200&start=0';

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(ECU911_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'ECU911 no disponible' }, { status: 502 });
    }

    const data = (await res.json()) as Ecu911Response;

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al consultar ECU911' }, { status: 502 });
  }
}
