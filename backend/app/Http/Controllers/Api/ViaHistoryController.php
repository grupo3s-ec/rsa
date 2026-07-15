<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ViaStatusEvent;
use App\Services\ViaPollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ViaHistoryController extends Controller
{
    /** Histórico de eventos de cambio de estado de vías, filtrable por
     * provincia(s) (para acotar a una ruta), estado (tipo de evento) y fecha. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provincias'        => ['sometimes', 'string'],
            'estado_actual_id'  => ['sometimes', 'integer'],
            'from'              => ['sometimes', 'date'],
            'to'                => ['sometimes', 'date'],
            'search'            => ['sometimes', 'string', 'max:120'],
        ]);

        $query = ViaStatusEvent::query()->orderByDesc('detected_at');

        if (!empty($data['provincias'])) {
            $provincias = array_filter(explode(',', $data['provincias']));
            if ($provincias !== []) {
                $query->whereIn('provincia', $provincias);
            }
        }

        if (isset($data['estado_actual_id'])) {
            $query->where('estado_actual_id', $data['estado_actual_id']);
        }

        if (!empty($data['from'])) {
            $query->where('detected_at', '>=', $data['from']);
        }

        if (!empty($data['to'])) {
            $query->where('detected_at', '<=', Carbon::parse($data['to'])->endOfDay());
        }

        if (!empty($data['search'])) {
            $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $term = $data['search'];
            $query->where(function ($q) use ($term, $like): void {
                $q->where('descripcion', $like, "%{$term}%")
                    ->orWhere('provincia', $like, "%{$term}%")
                    ->orWhere('canton', $like, "%{$term}%");
            });
        }

        return response()->json($query->paginate(50));
    }

    /** Dispara la consulta a ECU911 y registra los cambios de estado detectados.
     * Protegido por token compartido (no auth:sanctum) para que un cron externo
     * pueda llamarlo sin sesión de usuario — mismo patrón que /ping para el
     * warmup de Render free tier. */
    public function poll(Request $request): JsonResponse
    {
        $expected = (string) config('services.via_poll.token');
        $provided = (string) $request->query('token', '');

        if ($expected === '' || !hash_equals($expected, $provided)) {
            abort(403, 'Token inválido.');
        }

        $registered = app(ViaPollService::class)->pollAndRecordChanges();

        return response()->json(['registered' => $registered]);
    }
}
