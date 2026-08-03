<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Reporte de Riesgos de Ruta — RSA</title>
    <style>
        @page { margin: 28px 32px; }
        body { font-family: 'Helvetica', Arial, sans-serif; font-size: 11px; color: #1f2937; }

        .header { margin-bottom: 16px; }
        .header h1 { font-size: 18px; margin: 0 0 2px; color: #1A3562; }
        .header p { margin: 0; color: #6b7280; font-size: 10px; }

        .mapa { width: 100%; text-align: center; margin-bottom: 14px; }
        .mapa img { max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; }

        .leyenda { width: 100%; margin-bottom: 16px; font-size: 9px; color: #6b7280; }
        .leyenda span { display: inline-block; margin-right: 14px; }
        .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px; }
        .dot-red { background: #ef4444; }
        .dot-blue { background: #3b82f6; }
        .dot-green { background: #22c55e; }

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
        .imp-alto  { background-color: #ef4444; }
        .imp-medio { background-color: #f59e0b; }
        .imp-bajo  { background-color: #10b981; }

        .footer { margin-top: 20px; font-size: 9px; color: #9ca3af; text-align: right; }
    </style>
</head>
<body>

@php
    $impactoClass = ['Alto' => 'imp-alto', 'Medio' => 'imp-medio', 'Bajo' => 'imp-bajo'];
@endphp

<div class="header">
    <h1>RSA — Reporte de Riesgos de Ruta</h1>
    <p>{{ $evaluation->nombre }} &nbsp;·&nbsp; Generado: {{ $generadoEn->format('d/m/Y H:i') }}</p>
</div>

@if ($mapaUrl)
    <div class="mapa">
        <img src="{{ $mapaUrl }}" alt="Mapa de la ruta con riesgos principales">
    </div>
    <div class="leyenda">
        <span><span class="dot dot-red"></span>Riesgo principal (impacto Alto)</span>
        <span><span class="dot dot-blue"></span>Gasolinera</span>
        <span><span class="dot dot-green"></span>UPC / Policía</span>
    </div>
@endif

<h2 class="section">Riesgos principales (impacto Alto)</h2>
@if ($principales->count() === 0)
    <p class="empty">Sin riesgos de impacto Alto registrados.</p>
@else
    <table class="data">
        <thead><tr><th>Km</th><th>Condición</th><th>Tipo</th><th>Riesgo</th></tr></thead>
        <tbody>
        @foreach ($principales as $km)
            @foreach ($km->conditions as $c)
                @if (($c['impacto'] ?? null) === 'Alto')
                    <tr>
                        <td>{{ $km->km_label }}</td>
                        <td>{{ $c['condicion'] }}</td>
                        <td>{{ $c['tipo'] }}</td>
                        <td>{{ $c['riesgos'] ?? '—' }}</td>
                    </tr>
                @endif
            @endforeach
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section">Puntos de interés cercanos a la ruta (Google Maps)</h2>
@if (count($pois) === 0)
    <p class="empty">Sin gasolineras ni UPC encontradas cerca de la ruta.</p>
@else
    <table class="data">
        <thead><tr><th>Tipo</th><th>Nombre</th><th>Dirección</th></tr></thead>
        <tbody>
        @foreach ($pois as $p)
            <tr>
                <td>{{ $p['tipo'] }}</td>
                <td>{{ $p['name'] }}</td>
                <td>{{ $p['address'] }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section">Detalle por tramo (cada 50 km)</h2>
@foreach ($tramos as $inicio => $tramoKms)
    <p style="font-weight: bold; color: #1A3562; margin: 10px 0 4px;">
        Km {{ $inicio }} – {{ $inicio + 49 }}
    </p>
    <table class="data">
        <thead><tr><th>Km</th><th>Tipo de vía</th><th>Condiciones</th><th>Comentario</th></tr></thead>
        <tbody>
        @foreach ($tramoKms as $km)
            <tr>
                <td>{{ $km->km_label }}</td>
                <td>{{ $km->tipo_camino ?? '—' }}</td>
                <td>
                    @foreach ($km->conditions as $c)
                        <span class="badge {{ $impactoClass[$c['impacto']] ?? '' }}">{{ $c['impacto'] ?? '?' }}</span>
                    @endforeach
                    {{ collect($km->conditions)->pluck('tipo')->implode(', ') }}
                </td>
                <td>{{ $km->comentario ?? '—' }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endforeach

<div class="footer">RSA — Route Safety Analysis · Grupo3S</div>

</body>
</html>
