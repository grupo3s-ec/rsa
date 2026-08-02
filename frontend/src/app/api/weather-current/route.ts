import { NextResponse } from 'next/server';

interface GoogleWeatherResponse {
  temperature?: { degrees: number; unit: string };
  feelsLikeTemperature?: { degrees: number; unit: string };
  weatherCondition?: {
    type: string;
    description?: { text: string; languageCode: string };
    iconBaseUri?: string;
  };
  precipitation?: {
    probability?: { type: string; percent: number };
    qpf?: { quantity: number; unit: string };
  };
  relativeHumidity?: number;
  currentTime?: string;
  error?: { message?: string; status?: string };
}

export interface CurrentWeather {
  temperatureC: number;
  feelsLikeC: number;
  conditionText: string;
  iconUri: string | null;
  precipProbabilityPercent: number;
  precipQpfMm: number;
  relativeHumidity: number | null;
  observedAt: string | null;
}

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Faltan lat/lng' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const url = `https://weather.googleapis.com/v1/currentConditions:lookup`
    + `?key=${key}&location.latitude=${encodeURIComponent(lat)}&location.longitude=${encodeURIComponent(lng)}&unitsSystem=METRIC`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    const data = (await res.json()) as GoogleWeatherResponse;

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? `Weather API status ${res.status}` },
        { status: 502 },
      );
    }

    const weather: CurrentWeather = {
      temperatureC: data.temperature?.degrees ?? 0,
      feelsLikeC: data.feelsLikeTemperature?.degrees ?? data.temperature?.degrees ?? 0,
      conditionText: data.weatherCondition?.description?.text ?? '',
      iconUri: data.weatherCondition?.iconBaseUri ?? null,
      precipProbabilityPercent: data.precipitation?.probability?.percent ?? 0,
      precipQpfMm: data.precipitation?.qpf?.quantity ?? 0,
      relativeHumidity: data.relativeHumidity ?? null,
      observedAt: data.currentTime ?? null,
    };

    return NextResponse.json(weather);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
