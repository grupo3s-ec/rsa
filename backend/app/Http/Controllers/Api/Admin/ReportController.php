<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /** @return array{from: Carbon, to: Carbon} */
    private function resolvePeriod(Request $request): array
    {
        $request->validate([
            'from' => ['sometimes', 'date'],
            'to'   => ['sometimes', 'date'],
        ]);

        return [
            'from' => $request->filled('from') ? Carbon::parse($request->string('from')) : now()->subDays(29)->startOfDay(),
            'to'   => $request->filled('to')   ? Carbon::parse($request->string('to'))->endOfDay() : now()->endOfDay(),
        ];
    }

    private function buildSummary(Carbon $from, Carbon $to): array
    {
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

        return [
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
        ];
    }

    public function incidents(Request $request): JsonResponse
    {
        ['from' => $from, 'to' => $to] = $this->resolvePeriod($request);

        return response()->json($this->buildSummary($from, $to));
    }

    public function exportPdf(Request $request): Response
    {
        ['from' => $from, 'to' => $to] = $this->resolvePeriod($request);

        $summary = $this->buildSummary($from, $to);

        $incidentes = Incident::query()
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'type', 'severity', 'status', 'source', 'latitude', 'longitude', 'occurred_at', 'created_at']);

        $pdf = Pdf::loadView('reports.incidents', [
            'summary'      => $summary,
            'incidentes'   => $incidentes,
            'generadoEn'   => now(),
        ])->setPaper('a4', 'portrait');

        return $pdf->download('reporte-incidentes.pdf');
    }

    public function export(Request $request): StreamedResponse
    {
        ['from' => $from, 'to' => $to] = $this->resolvePeriod($request);

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
