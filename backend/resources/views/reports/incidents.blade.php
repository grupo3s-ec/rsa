<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Reporte de Incidentes — RSA</title>
    <style>
        @page { margin: 28px 32px; }
        body { font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; color: #1f2937; }

        .header { margin-bottom: 16px; }
        .header h1 { font-size: 18px; margin: 0 0 2px; color: #1A3562; }
        .header p { margin: 0; color: #6b7280; font-size: 10px; }

        .kpis { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .kpis td {
            width: 33.33%;
            border: 1px solid #e5e7eb;
            padding: 10px 12px;
            text-align: left;
        }
        .kpis .label { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
        .kpis .value { display: block; font-size: 20px; font-weight: bold; color: #1A3562; margin-top: 2px; }

        h2.section {
            font-size: 12px;
            color: #1A3562;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 4px;
            margin: 18px 0 8px;
        }

        table.data { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        table.data th, table.data td {
            border: 1px solid #e5e7eb;
            padding: 5px 7px;
            text-align: left;
            font-size: 10px;
        }
        table.data th { background-color: #f3f4f6; color: #374151; font-weight: bold; }
        table.data tr:nth-child(even) td { background-color: #fafafa; }

        .empty { color: #9ca3af; font-style: italic; padding: 6px 0; }

        .badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            color: #ffffff;
        }
        .sev-critical { background-color: #ef4444; }
        .sev-high     { background-color: #f97316; }
        .sev-medium   { background-color: #eab308; }
        .sev-low      { background-color: #22c55e; }

        .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: right; }
    </style>
</head>
<body>

@php
    $tipoLabels = [
        'accident'    => 'Accidente',
        'road_damage' => 'Vía dañada',
        'landslide'   => 'Deslizamiento',
        'closure'     => 'Cierre',
        'risk'        => 'Riesgo',
        'checkpoint'  => 'Control',
        'assistance'  => 'Asistencia',
    ];
    $sevLabels = ['critical' => 'Crítica', 'high' => 'Alta', 'medium' => 'Media', 'low' => 'Baja'];
    $statusLabels = ['open' => 'Abierto', 'in_progress' => 'En progreso', 'resolved' => 'Resuelto', 'archived' => 'Archivado'];
    $sourceLabels = ['manual' => 'Manual', 'google_drive' => 'Google Drive', 'geotab' => 'Geotab'];
@endphp

<div class="header">
    <h1>RSA — Reporte de Incidentes</h1>
    <p>
        Período: {{ $summary['period']['from'] }} a {{ $summary['period']['to'] }}
        &nbsp;·&nbsp; Generado: {{ $generadoEn->format('d/m/Y H:i') }}
    </p>
</div>

<table class="kpis">
    <tr>
        <td>
            <span class="label">Total incidentes</span>
            <span class="value">{{ $summary['totals']['all'] }}</span>
        </td>
        <td>
            <span class="label">Abiertos</span>
            <span class="value">{{ $summary['totals']['open'] }}</span>
        </td>
        <td>
            <span class="label">En el período</span>
            <span class="value">{{ $summary['totals']['in_period'] }}</span>
        </td>
    </tr>
</table>

<h2 class="section">Por tipo</h2>
@if (count($summary['by_type']) === 0)
    <p class="empty">Sin datos.</p>
@else
    <table class="data">
        <thead><tr><th>Tipo</th><th>Total</th></tr></thead>
        <tbody>
        @foreach ($summary['by_type'] as $row)
            <tr>
                <td>{{ $tipoLabels[$row['type']] ?? $row['type'] }}</td>
                <td>{{ $row['total'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section">Por severidad</h2>
@if (count($summary['by_severity']) === 0)
    <p class="empty">Sin datos.</p>
@else
    <table class="data">
        <thead><tr><th>Severidad</th><th>Total</th></tr></thead>
        <tbody>
        @foreach ($summary['by_severity'] as $row)
            <tr>
                <td>{{ $sevLabels[$row['severity']] ?? $row['severity'] }}</td>
                <td>{{ $row['total'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section">Por fuente</h2>
@if (count($summary['by_source']) === 0)
    <p class="empty">Sin datos.</p>
@else
    <table class="data">
        <thead><tr><th>Fuente</th><th>Total</th></tr></thead>
        <tbody>
        @foreach ($summary['by_source'] as $row)
            <tr>
                <td>{{ $sourceLabels[$row['source']] ?? $row['source'] }}</td>
                <td>{{ $row['total'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section">Detalle de incidentes en el período</h2>
@if ($incidentes->count() === 0)
    <p class="empty">Sin incidentes registrados en el período seleccionado.</p>
@else
    <table class="data">
        <thead>
            <tr>
                <th>ID</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Severidad</th>
                <th>Estado</th>
                <th>Fuente</th>
                <th>Lat</th>
                <th>Long</th>
                <th>Ocurrido</th>
            </tr>
        </thead>
        <tbody>
        @foreach ($incidentes as $i)
            <tr>
                <td>{{ $i->id }}</td>
                <td>{{ $i->title }}</td>
                <td>{{ $tipoLabels[$i->type] ?? $i->type }}</td>
                <td><span class="badge sev-{{ $i->severity }}">{{ $sevLabels[$i->severity] ?? $i->severity }}</span></td>
                <td>{{ $statusLabels[$i->status] ?? $i->status }}</td>
                <td>{{ $sourceLabels[$i->source] ?? $i->source }}</td>
                <td>{{ $i->latitude }}</td>
                <td>{{ $i->longitude }}</td>
                <td>{{ optional($i->occurred_at)->format('d/m/Y H:i') ?? '—' }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<div class="footer">RSA — Route Safety Analysis · Grupo3S</div>

</body>
</html>
