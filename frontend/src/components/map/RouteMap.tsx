"use client";

/**
 * Mapa Mapbox a pantalla completa: ruta A→B, marcadores de origen/destino
 * y marcadores de incidentes coloreados por severidad.
 *
 * Solo cliente — se carga vía `next/dynamic({ ssr: false })` desde RoutePlanner.
 */

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import { Flag, MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_MAPBOX_CONFIGURED, MAPBOX_TOKEN } from "@/lib/config";
import { severityMeta, typeMeta } from "@/lib/incidents/format";
import type { LngLat, RouteLineString } from "@/lib/mapbox/directions";
import type { Incident } from "@/types/incident";

const MAP_STYLE = "mapbox://styles/mapbox/standard";

interface RouteMapProps {
  origin: LngLat | null;
  destination: LngLat | null;
  routeGeometry: RouteLineString | null;
  incidents: Incident[];
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
  onMapClick?: (lngLat: LngLat) => void;
}

/** Feature GeoJSON mínimo para la fuente de la ruta. */
interface RouteFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: RouteLineString;
}

/** Estado vacío elegante cuando aún no hay token de Mapbox. */
function MapNotConfigured() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-muted/40 via-background to-muted/60">
      <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-border/60 bg-background/80 p-8 text-center shadow-lg backdrop-blur">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MapPinned className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">Mapa listo para conectar</h2>
          <p className="text-sm text-muted-foreground">
            Configura{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            en <span className="font-medium text-foreground">.env.local</span>{" "}
            para activar la vista de ruta en tiempo real.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RouteMap({
  origin,
  destination,
  routeGeometry,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onMapClick,
}: RouteMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Encuadra el mapa cubriendo origen, destino y ruta cuando cambian.
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded) {
      return;
    }

    const points: LngLat[] = [];

    if (origin) points.push(origin);
    if (destination) points.push(destination);
    if (routeGeometry) points.push(...routeGeometry.coordinates);

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.flyTo({ center: points[0], zoom: 13, duration: 800 });
      return;
    }

    let minLng = points[0][0];
    let minLat = points[0][1];
    let maxLng = points[0][0];
    let maxLat = points[0][1];

    for (const [lng, lat] of points) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 90, duration: 800, maxZoom: 15 },
    );
  }, [origin, destination, routeGeometry, mapLoaded]);

  // Centra suavemente el incidente seleccionado (desde la lista o el marcador).
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapLoaded || selectedIncidentId === null) {
      return;
    }

    const selected = incidents.find(
      (incident) => incident.id === selectedIncidentId,
    );

    if (selected) {
      map.easeTo({
        center: [selected.longitude, selected.latitude],
        duration: 600,
      });
    }
  }, [selectedIncidentId, incidents, mapLoaded]);

  // Sincroniza el preset día/noche del Standard style con el tema de la app.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;
    map.setConfigProperty("basemap", "lightPreset", isDark ? "night" : "day");
  }, [isDark, mapLoaded]);

  if (!IS_MAPBOX_CONFIGURED) {
    return <MapNotConfigured />;
  }

  const routeFeature: RouteFeature | null = routeGeometry
    ? { type: "Feature", properties: {}, geometry: routeGeometry }
    : null;

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={MAP_STYLE}
      initialViewState={{ longitude: -78.4678, latitude: -0.1807, zoom: 11 }}
      style={{ width: "100%", height: "100%" }}
      onLoad={() => {
        setMapLoaded(true);
        mapRef.current?.getMap().setConfigProperty("basemap", "lightPreset", isDark ? "night" : "day");
      }}
      onClick={(event) => {
        onMapClick?.([event.lngLat.lng, event.lngLat.lat]);
      }}
    >
      <NavigationControl position="bottom-right" showCompass={false} />

      {/* Ruta: casing oscuro debajo + línea principal azul encima. */}
      {routeFeature ? (
        <Source id="route" type="geojson" data={routeFeature}>
          <Layer
            id="route-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": "#1e3a8a",
              "line-width": 9,
              "line-opacity": 0.55,
            }}
          />
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#2563eb", "line-width": 6 }}
          />
        </Source>
      ) : null}

      {/* Origen: anillo verde con punto central. */}
      {origin ? (
        <Marker longitude={origin[0]} latitude={origin[1]} anchor="center">
          <span className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md">
            <span className="size-1.5 rounded-full bg-white" />
          </span>
        </Marker>
      ) : null}

      {/* Destino: bandera sobre pin oscuro. */}
      {destination ? (
        <Marker longitude={destination[0]} latitude={destination[1]} anchor="bottom">
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-lg">
            <Flag className="size-3.5" />
          </span>
        </Marker>
      ) : null}

      {/* Incidentes: círculo con icono del tipo y color de severidad. */}
      {incidents.map((incident) => {
        const TypeIcon = typeMeta[incident.type].icon;
        const severity = severityMeta[incident.severity];
        const isSelected = selectedIncidentId === incident.id;
        const isCritical = incident.severity === "critical";

        return (
          <Marker
            key={incident.id}
            longitude={incident.longitude}
            latitude={incident.latitude}
            anchor="center"
          >
            <button
              type="button"
              aria-label={incident.title}
              onClick={(event) => {
                event.stopPropagation();
                onSelectIncident(incident);
              }}
              className={cn(
                "relative flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform duration-200 hover:scale-115 focus-visible:scale-115 focus-visible:outline-none",
                isSelected && "scale-120 ring-2 ring-white/80",
              )}
              style={{ backgroundColor: severity.hex }}
            >
              {isCritical ? (
                <span
                  aria-hidden
                  className="rsa-marker-pulse absolute inset-0 rounded-full"
                  style={{ backgroundColor: severity.hex }}
                />
              ) : null}
              <TypeIcon className="relative size-4" />
            </button>
          </Marker>
        );
      })}
    </Map>
  );
}
