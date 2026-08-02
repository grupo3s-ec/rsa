import type { CurrentWeather } from "@/app/api/weather-current/route";

export type { CurrentWeather };

/**
 * Clima ACTUAL (Google Weather API) para un punto — complementa, no
 * reemplaza, la climatología histórica de INAMHI que ya muestra la app
 * (son datos de naturaleza distinta: "qué tiempo hace ahora" vs. "qué tan
 * lluvioso es este mes en promedio"). `null` si el API no responde — el
 * llamador debe tratarlo como "sin dato en vivo", no como error fatal.
 */
export async function getCurrentWeather(lat: number, lng: number): Promise<CurrentWeather | null> {
  try {
    const res = await fetch(`/api/weather-current?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    return (await res.json()) as CurrentWeather;
  } catch {
    return null;
  }
}
