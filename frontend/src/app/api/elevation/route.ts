import { NextResponse } from 'next/server';

interface ElevationBody {
  locations: Array<{ lat: number; lng: number }>;
}

interface GoogleResult {
  elevation: number;
  location: { lat: number; lng: number };
  resolution: number;
}

interface GoogleElevationResponse {
  results: GoogleResult[];
  status: string;
  error_message?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { locations } = (await req.json()) as ElevationBody;

  if (!locations || locations.length === 0) {
    return NextResponse.json({ error: 'Sin ubicaciones' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const locStr = locations.map((l) => `${l.lat},${l.lng}`).join('|');
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locStr)}&key=${key}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as GoogleElevationResponse;

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: data.error_message ?? data.status },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
