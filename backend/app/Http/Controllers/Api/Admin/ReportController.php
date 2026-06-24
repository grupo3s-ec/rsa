<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function incidents(Request $request): JsonResponse
    {
        $from = $request->date('from') ?? now()->subDays(29)->startOfDay();
        $to   = $request->date('to')   ?? now()->endOfDay();

        $byPeriod = Incident::query()
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('date')
            ->get();

        $byType = Incident::query()
            ->selectRaw('type, COUNT(*) as total')
            ->groupBy('type')
            ->orderByDesc('total')
            ->get();

        $bySeverity = Incident::query()
            ->selectRaw('severity, COUNT(*) as total')
            ->groupBy('severity')
            ->orderByDesc('total')
            ->get();

        $bySource = Incident::query()
            ->selectRaw('source, COUNT(*) as total')
            ->groupBy('source')
            ->orderByDesc('total')
            ->get();

        return response()->json([
            'period'      => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals'      => [
                'all'        => Incident::count(),
                'open'       => Incident::where('status', 'open')->count(),
                'in_period'  => Incident::whereBetween('created_at', [$from, $to])->count(),
            ],
            'by_period'   => $byPeriod,
            'by_type'     => $byType,
            'by_severity' => $bySeverity,
            'by_source'   => $bySource,
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $from = $request->date('from') ?? now()->subDays(29)->startOfDay();
        $to   = $request->date('to')   ?? now()->endOfDay();

        $incidents = Incident::query()
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'type', 'severity', 'status', 'source', 'latitude', 'longitude', 'occurred_at', 'created_at']);

        return response()->streamDownload(function () use ($incidents): void {
            $out = fopen('php://output', 'w');
            // BOM para compatibilidad con Excel
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['ID', 'Título', 'Tipo', 'Severidad', 'Estado', 'Fuente', 'Latitud', 'Longitud', 'Ocurrido', 'Creado']);
            foreach ($incidents as $i) {
                fputcsv($out, [
                    $i->id,
                    $i->title,
                    $i->type,
                    $i->severity,
                    $i->status,
                    $i->source,
                    $i->latitude,
                    $i->longitude,
                    $i->occurred_at,
                    $i->created_at,
                ]);
            }
            fclose($out);
        }, 'incidentes.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
