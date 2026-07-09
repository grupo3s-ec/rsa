import { NextResponse } from 'next/server';
import type { Ecu911Response } from '@/types/ecu911';

// Excluye estado_actual_id=593 (HABILITADA) → solo vías con problemas
const ECU911_URL =
  'https://ecu911.gob.ec/Services/WSVias/ViasWeb.php' +
  '?estado=A&and:%3C%3E:EstadoActual-id=593&order=modified+DESC&limit=200&start=0';

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(ECU911_URL, {
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.ecu911.gob.ec/',
        'User-Agent': 'Mozilla/5.0 (compatible; RSA/1.0)',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ECU911 respondió ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as Ecu911Response;

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
