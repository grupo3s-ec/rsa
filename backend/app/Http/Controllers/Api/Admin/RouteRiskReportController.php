<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\RiskEvaluation;
use App\Services\GooglePlacesService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RouteRiskReportController extends Controller
{
    private const STATIC_MAP_ENDPOINT = 'https://maps.googleapis.com/maps/api/staticmap';

    /** Cada cuántos km se busca gasolineras/UPC cerca del punto — buscar en
     * cada km sería decenas de llamadas a Places API por reporte. */
    private const POI_SAMPLE_EVERY_KM = 15;
    private const POI_RADIUS_METERS = 4000;

    /** Genera el PDF de la ruta: mapa con símbolos de riesgos principales
     * (impacto Alto) + gasolineras/UPC de Google Places, y una tabla de
     * riesgos agrupada por tramos de 50 km — igual al pedido original
     * ("reporte tipo chorrillos, solo símbolos, en base al Excel de
     * evaluación de riesgos"). Los puntos de interés se toman de Google Maps
     * directo (ya los marcan los propios usuarios), no de una base aparte. */
    public function exportPdf(Request $request, GooglePlacesService $places): Response
    {
        $data = $request->validate([
            'evaluation_id' => ['sometimes', 'integer'],
        ]);

        $evaluation = isset($data['evaluation_id'])
            ? RiskEvaluation::query()->findOrFail($data['evaluation_id'])
            : RiskEvaluation::query()->orderBy('id')->firstOrFail();

        $kms = $evaluation->kms()->orderBy('km_number')->get();

        $principales = $kms->filter(
            fn ($km) => collect($km->conditions)->contains(fn ($c) => ($c['impacto'] ?? null) === 'Alto'),
        )->values();

        $pois = $this->collectPois($places, $kms);

        $staticMapDataUri = $this->buildStaticMapDataUri($kms, $principales, $pois);

        $tramos = $kms->groupBy(fn ($km) => intdiv($km->km_number, 50) * 50);

        $pdf = Pdf::loadView('reports.route-risk', [
            'evaluation'  => $evaluation,
            'kms'         => $kms,
            'principales' => $principales,
            'pois'        => $pois,
            'tramos'      => $tramos,
            'mapaUrl'     => $staticMapDataUri,
            'generadoEn'  => now(),
        ])->setPaper('a4', 'portrait');

        return $pdf->download(Str::slug($evaluation->nombre) . '-reporte-riesgos.pdf');
    }

    /**
     * @param \Illuminate\Support\Collection<int, \App\Models\RiskEvaluationKm> $kms
     * @return array<int, array{name: string, lat: float, lng: float, address: string, tipo: string}>
     */
    private function collectPois(GooglePlacesService $places, $kms): array
    {
        if ($kms->isEmpty()) {
            return [];
        }

        $pois = [];
        $vistos = [];

        foreach ($kms as $km) {
            if ($km->km_number % self::POI_SAMPLE_EVERY_KM !== 0) {
                continue;
            }

            foreach (['gas_station' => 'Gasolinera', 'police' => 'UPC / Policía'] as $type => $label) {
                foreach ($places->searchNearby((float) $km->lat, (float) $km->lng, self::POI_RADIUS_METERS, [$type], 3) as $p) {
                    // Redondeado a ~11m de precisión — suficiente para deduplicar
                    // el mismo lugar encontrado desde 2 puntos de muestreo cercanos.
                    $clave = round($p['lat'], 4) . ',' . round($p['lng'], 4);
                    if (isset($vistos[$clave])) {
                        continue;
                    }
                    $vistos[$clave] = true;
                    $pois[] = [...$p, 'tipo' => $label];
                }
            }
        }

        return $pois;
    }

    /**
     * @param \Illuminate\Support\Collection<int, \App\Models\RiskEvaluationKm> $kms
     * @param \Illuminate\Support\Collection<int, \App\Models\RiskEvaluationKm> $principales
     * @param array<int, array{lat: float, lng: float, tipo: string}> $pois
     */
    private function buildStaticMapDataUri($kms, $principales, array $pois): ?string
    {
        $key = (string) config('services.google_maps.server_key');
        if ($key === '' || $kms->isEmpty()) {
            return null;
        }

        $params = [
            'size'     => '640x480',
            'scale'    => '2',
            'maptype'  => 'roadmap',
            'key'      => $key,
        ];

        // Trazado de la ruta — muestreado cada 3 km para no exceder el largo
        // máximo de la URL de Static Maps con rutas de cientos de km.
        $pathPoints = $kms->filter(fn ($km) => $km->km_number % 3 === 0)
            ->map(fn ($km) => "{$km->lat},{$km->lng}")
            ->implode('|');
        $paths = ['color:0x1A3562|weight:3|' . $pathPoints];

        $markers = [];
        // Riesgos principales (impacto Alto) — rojo, hasta 60 para no exceder
        // el límite de la URL (~8000 caracteres).
        $riesgoPoints = $principales->take(60)->map(fn ($km) => "{$km->lat},{$km->lng}")->implode('|');
        if ($riesgoPoints !== '') {
            $markers[] = 'color:red|size:tiny|' . $riesgoPoints;
        }
        // Gasolineras — azul.
        $gasolineras = collect($pois)->where('tipo', 'Gasolinera')->map(fn ($p) => "{$p['lat']},{$p['lng']}")->implode('|');
        if ($gasolineras !== '') {
            $markers[] = 'color:blue|size:tiny|' . $gasolineras;
        }
        // UPC / Policía — verde.
        $upc = collect($pois)->where('tipo', 'UPC / Policía')->map(fn ($p) => "{$p['lat']},{$p['lng']}")->implode('|');
        if ($upc !== '') {
            $markers[] = 'color:green|size:tiny|' . $upc;
        }

        $query = http_build_query($params) . '&' . implode('&', array_map(
            static fn (string $p) => 'path=' . urlencode($p),
            $paths,
        )) . '&' . implode('&', array_map(
            static fn (string $m) => 'markers=' . urlencode($m),
            $markers,
        ));

        try {
            $response = Http::timeout(15)->get(self::STATIC_MAP_ENDPOINT . '?' . $query);
        } catch (\Throwable $e) {
            Log::warning("RouteRiskReportController: fallo al pedir el mapa estático — {$e->getMessage()}");

            return null;
        }

        if (!$response->successful()) {
            Log::warning('RouteRiskReportController: Static Maps devolvió error', ['status' => $response->status()]);

            return null;
        }

        return 'data:image/png;base64,' . base64_encode($response->body());
    }
}
