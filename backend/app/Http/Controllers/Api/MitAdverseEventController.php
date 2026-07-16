<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MitAdverseEvent;
use App\Services\MitEventClassifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MitAdverseEventController extends Controller
{
    /** Histórico de eventos adversos MTOP/MIT, filtrable por los mismos
     * criterios que las cabeceras del boletín: ruta/tramo, fecha del evento
     * y tipo de evento (además de provincia). */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ruta_codigo'  => ['sometimes', 'string', 'max:20'],
            'tipo_evento'  => ['sometimes', 'string', 'max:60'],
            'provincias'   => ['sometimes', 'string', 'max:255'],
            'search'       => ['sometimes', 'string', 'max:120'],
            'from'         => ['sometimes', 'date'],
            'to'           => ['sometimes', 'date'],
            // Filtro genérico por boletín (mes/año) — a diferencia de from/to
            // (fechas exactas, y fecha_evento_inicio/fin puede ser null), todo
            // evento siempre tiene boletin_mes/boletin_anio.
            'boletin_mes'  => ['sometimes', 'integer', 'between:1,12'],
            'boletin_anio' => ['sometimes', 'integer', 'between:2000,2100'],
        ]);

        // orderByDesc('fecha_evento_inicio') solo no es determinista: todas las
        // filas del mismo boletín mensual comparten esa misma fecha (día 1 del
        // mes), así que el desempate por 'id' evita que la paginación devuelva
        // una fila duplicada o salte una entre dos peticiones de página distintas.
        $query = MitAdverseEvent::query()->orderByDesc('fecha_evento_inicio')->orderByDesc('id');

        // isset(...) !== '' en vez de !empty(...): empty("0") es true en PHP,
        // así que !empty() trataría un filtro con valor literal "0" como si no
        // se hubiera enviado.
        if (isset($data['ruta_codigo']) && $data['ruta_codigo'] !== '') {
            // ruta_codigo puede tener varios códigos unidos por ", " (tramos que
            // mencionan 2 rutas, ej. "E20, E45") — se filtra por coincidencia
            // exacta de un código individual dentro de esa lista, no por
            // substring plano (evita que "E38" matchee "E383"/"E383A").
            $ruta = $data['ruta_codigo'];
            $query->where(function ($q) use ($ruta): void {
                $q->where('ruta_codigo', $ruta)
                    ->orWhere('ruta_codigo', 'like', "{$ruta}, %")
                    ->orWhere('ruta_codigo', 'like', "%, {$ruta}")
                    ->orWhere('ruta_codigo', 'like', "%, {$ruta}, %");
            });
        }

        if (isset($data['tipo_evento']) && $data['tipo_evento'] !== '') {
            $query->where('tipo_evento', $data['tipo_evento']);
        }

        if (!empty($data['provincias'])) {
            // CSV en vez de un solo valor: una ruta calculada puede cruzar
            // varias provincias, y antes solo se podía filtrar por una a la
            // vez (mismo patrón que ViaHistoryController::index()).
            $provincias = array_filter(explode(',', $data['provincias']));
            if ($provincias !== []) {
                $query->whereIn('provincia', $provincias);
            }
        }

        if (isset($data['from']) && $data['from'] !== '') {
            $query->where('fecha_evento_fin', '>=', $data['from']);
        }

        if (isset($data['to']) && $data['to'] !== '') {
            $query->where('fecha_evento_inicio', '<=', $data['to']);
        }

        if (isset($data['boletin_mes'])) {
            $query->where('boletin_mes', $data['boletin_mes']);
        }

        if (isset($data['boletin_anio'])) {
            $query->where('boletin_anio', $data['boletin_anio']);
        }

        if (isset($data['search']) && $data['search'] !== '') {
            $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            // Escapa los comodines propios de LIKE (% y _) para que un término
            // de búsqueda que los contenga se busque literal, no como patrón.
            $term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $data['search']);
            $pattern = "%{$term}%";
            $query->where(function ($q) use ($pattern, $like): void {
                $q->whereRaw("tramo {$like} ? ESCAPE '\\'", [$pattern])
                    ->orWhereRaw("evento {$like} ? ESCAPE '\\'", [$pattern]);
            });
        }

        return response()->json($query->paginate(50));
    }

    /** Valores disponibles para poblar los selects de filtro del frontend. */
    public function opciones(): JsonResponse
    {
        // ruta_codigo puede almacenar varios códigos unidos por ", " (tramos
        // con 2 rutas) — se separan para que el select del frontend ofrezca
        // cada código individual, no la combinación cruda como una sola opción.
        $rutas = MitAdverseEvent::query()
            ->whereNotNull('ruta_codigo')
            ->pluck('ruta_codigo')
            ->flatMap(fn (string $valor) => explode(', ', $valor))
            ->unique()
            ->sort()
            ->values();

        // Años con boletines cargados (para el select de año del filtro
        // genérico mes/año) — se consulta en vez de asumir un rango fijo,
        // igual que rutas/provincias arriba.
        $anios = MitAdverseEvent::query()
            ->distinct()
            ->orderByDesc('boletin_anio')
            ->pluck('boletin_anio');

        return response()->json([
            'tipos_evento'  => MitEventClassifier::tiposEvento(),
            'rutas'         => $rutas,
            'provincias'    => MitAdverseEvent::query()
                ->distinct()
                ->orderBy('provincia')
                ->pluck('provincia'),
            'boletin_anios' => $anios,
        ]);
    }
}
