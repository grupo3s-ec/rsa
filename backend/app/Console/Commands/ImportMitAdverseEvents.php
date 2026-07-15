<?php

namespace App\Console\Commands;

use App\Models\MitAdverseEvent;
use App\Services\MitEventClassifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ImportMitAdverseEvents extends Command
{
    protected $signature = 'mit:import {--path=database/data/mit_adverse_events_raw.json}';

    protected $description = 'Importa el histórico de eventos adversos MTOP/MIT extraído de los boletines mensuales (reemplaza los datos existentes)';

    public function handle(MitEventClassifier $classifier): int
    {
        $path = base_path($this->option('path'));

        if (!is_file($path)) {
            $this->error("No existe el archivo: {$path}");

            return self::FAILURE;
        }

        $rows = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);

        if (!is_array($rows)) {
            $this->error('El archivo no contiene un arreglo JSON válido.');

            return self::FAILURE;
        }

        DB::transaction(function () use ($rows, $classifier): void {
            MitAdverseEvent::query()->delete();

            foreach ($rows as $row) {
                $tramo = (string) $row['tramo'];
                $evento = (string) $row['evento'];
                $boletinMes = (int) $row['boletin_mes'];
                $boletinAnio = (int) $row['boletin_anio'];

                MitAdverseEvent::query()->create([
                    'region'               => $row['region'] ?? null,
                    'provincia'            => $row['provincia'],
                    'fecha_periodo_texto'  => $row['fecha_periodo_texto'],
                    'tramo'                => $tramo,
                    'evento'               => $evento,
                    'acciones_realizadas'  => $row['acciones_realizadas'] ?? null,
                    'observaciones'        => $row['observaciones'] ?? null,
                    'recomendaciones'      => $row['recomendaciones'] ?? null,
                    'ruta_codigo'          => $classifier->rutaCodigo($tramo),
                    'tipo_evento'          => $classifier->tipoEvento($evento, $row['acciones_realizadas'] ?? null),
                    'fecha_evento_inicio'  => Carbon::create($boletinAnio, $boletinMes, 1)->startOfMonth(),
                    'fecha_evento_fin'     => Carbon::create($boletinAnio, $boletinMes, 1)->endOfMonth(),
                    'geocoding_status'     => 'pendiente',
                    'fuente_nombre'        => $row['fuente_nombre'],
                    'fuente_boletin'       => $row['fuente_boletin'],
                    'boletin_mes'          => $boletinMes,
                    'boletin_anio'         => $boletinAnio,
                ]);
            }
        });

        $this->info('Importados ' . count($rows) . ' eventos.');

        return self::SUCCESS;
    }
}
