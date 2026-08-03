<?php

namespace App\Console\Commands;

use App\Models\AntAccident;
use App\Services\AntSiniestrosImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ImportAntAccidents extends Command
{
    protected $signature = 'ant:import {--path=database/data/ant_siniestros_2026.json} {--xlsx=}';

    protected $description = 'Importa la base de datos de siniestros de tránsito de la ANT — se actualiza subiendo un nuevo archivo cada mes (--xlsx lee un .xlsx directo con upsert; sin esa opción usa el JSON histórico ya extraído, reemplazando la tabla)';

    /** Excel guarda fechas como días desde este día 0 (sistema 1900, con el
     * bug de compatibilidad de Lotus 1-2-3 que Excel hereda). */
    private const EXCEL_EPOCH = '1899-12-30';

    public function handle(AntSiniestrosImporter $importer): int
    {
        $xlsxPath = $this->option('xlsx');
        if ($xlsxPath) {
            if (!is_file($xlsxPath)) {
                $this->error("No existe el archivo: {$xlsxPath}");

                return self::FAILURE;
            }

            $resultado = $importer->importFromXlsx($xlsxPath);
            $this->info("Creados {$resultado['creados']}, actualizados {$resultado['actualizados']} de {$resultado['total']} filas.");
            if ($resultado['omitidos'] > 0) {
                $this->warn("Omitidos {$resultado['omitidos']} sin coordenadas.");
            }

            return self::SUCCESS;
        }

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

        $epoch = Carbon::parse(self::EXCEL_EPOCH);
        $omitidos = 0;

        DB::transaction(function () use ($rows, $epoch, &$omitidos): void {
            AntAccident::query()->delete();

            foreach ($rows as $row) {
                $lat = $row['lat'] ?? null;
                $lng = $row['lng'] ?? null;
                if ($lat === null || $lng === null || $lat === '' || $lng === '') {
                    $omitidos++;
                    continue;
                }

                $fecha = isset($row['fecha_serial']) && $row['fecha_serial'] !== ''
                    ? $epoch->copy()->addDays((int) $row['fecha_serial'])->toDateString()
                    : null;

                $hora = isset($row['hora_fraccion']) && $row['hora_fraccion'] !== ''
                    ? gmdate('H:i:s', (int) round(((float) $row['hora_fraccion']) * 86400))
                    : null;

                // "ND" ("No Disponible") es el literal que usa la ANT para
                // campos sin dato — se guarda como null en vez de ese texto.
                $nd = static fn (?string $v) => ($v === null || $v === 'ND' || $v === '') ? null : $v;

                AntAccident::query()->create([
                    'codigo'             => $row['codigo'],
                    'anio'               => (int) ($row['anio'] ?? 0),
                    'fecha'              => $fecha,
                    'hora'               => $hora,
                    'lat'                => (float) $lat,
                    'lng'                => (float) $lng,
                    'dpa_provincia'      => $nd($row['dpa_provincia'] ?? null),
                    'provincia'          => $nd($row['provincia'] ?? null),
                    'dpa_canton'         => $nd($row['dpa_canton'] ?? null),
                    'canton'             => $nd($row['canton'] ?? null),
                    'dpa_parroquia'      => $nd($row['dpa_parroquia'] ?? null),
                    'parroquia'          => $nd($row['parroquia'] ?? null),
                    'direccion'          => $nd($row['direccion'] ?? null),
                    'zona_planificacion' => $nd($row['zona_planificacion'] ?? null),
                    'zona'               => $nd($row['zona'] ?? null),
                    'id_via'             => $nd($row['id_via'] ?? null),
                    'nombre_via'         => $nd($row['nombre_via'] ?? null),
                    'ente_control'       => $nd($row['ente_control'] ?? null),
                    'feriado'            => ($row['feriado'] ?? null) === 'SI',
                    'codigo_causa'       => $nd($row['codigo_causa'] ?? null),
                    'causa_probable'     => $nd($row['causa_probable'] ?? null),
                    'tipo_siniestro'     => $nd($row['tipo_siniestro'] ?? null),
                    'lesionados'         => (int) ($row['lesionados'] ?? 0),
                    'fallecidos'         => (int) ($row['fallecidos'] ?? 0),
                    'num_vehiculos'      => (int) ($row['num_vehiculos'] ?? 0),
                ]);
            }
        });

        $this->info('Importados ' . (count($rows) - $omitidos) . ' siniestros.');
        if ($omitidos > 0) {
            $this->warn("Omitidos {$omitidos} sin coordenadas.");
        }

        return self::SUCCESS;
    }
}
