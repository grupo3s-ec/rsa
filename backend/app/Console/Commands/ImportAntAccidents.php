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
        $ahora = now();
        $toInsert = [];

        // "ND" ("No Disponible") es el literal que usa la ANT para campos sin
        // dato — se guarda como null en vez de ese texto.
        $nd = static fn (?string $v) => ($v === null || $v === 'ND' || $v === '') ? null : $v;
        // `nombre_via` es varchar(120) pero algunas descripciones crudas de la
        // ANT superan eso (ej. límites entre provincias con nombre largo) —
        // sin truncar, esa fila hace overflow e interrumpe el insert en bloque
        // que la contenga. Es solo texto descriptivo, truncar no pierde nada
        // que importe (código/coordenadas/tipo van en sus propias columnas).
        $ndTrunc = static fn (?string $v, int $max) => $v === null ? null : mb_substr($v, 0, $max);

        foreach ($rows as $row) {
            $lat = $row['lat'] ?? null;
            $lng = $row['lng'] ?? null;
            if ($lat === null || $lng === null || $lat === '' || $lng === '') {
                $omitidos++;
                continue;
            }

            // La BDD cruda de la ANT trae de vez en cuando una fila con lat/lng
            // corrupta (signo invertido, lat/lng intercambiadas, o el punto
            // decimal perdido en la extracción — ej. "-78198026" en vez de
            // "-78.198026"). Sin este filtro, una sola fila así hace overflow
            // en la columna decimal(10,7) y aborta el insert en bloque que la
            // contenga. El rango cubre Ecuador continental + Galápagos con margen.
            if (
                !is_numeric($lat) || !is_numeric($lng)
                || (float) $lat < -6 || (float) $lat > 2
                || (float) $lng < -93 || (float) $lng > -74
            ) {
                $omitidos++;
                continue;
            }

            $fecha = isset($row['fecha_serial']) && $row['fecha_serial'] !== ''
                ? $epoch->copy()->addDays((int) $row['fecha_serial'])->toDateString()
                : null;

            $hora = isset($row['hora_fraccion']) && $row['hora_fraccion'] !== ''
                ? gmdate('H:i:s', (int) round(((float) $row['hora_fraccion']) * 86400))
                : null;

            $toInsert[] = [
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
                'nombre_via'         => $ndTrunc($nd($row['nombre_via'] ?? null), 120),
                'ente_control'       => $nd($row['ente_control'] ?? null),
                'feriado'            => ($row['feriado'] ?? null) === 'SI',
                'codigo_causa'       => $nd($row['codigo_causa'] ?? null),
                'causa_probable'     => $nd($row['causa_probable'] ?? null),
                'tipo_siniestro'     => $nd($row['tipo_siniestro'] ?? null),
                'lesionados'         => (int) ($row['lesionados'] ?? 0),
                'fallecidos'         => (int) ($row['fallecidos'] ?? 0),
                'num_vehiculos'      => (int) ($row['num_vehiculos'] ?? 0),
                'created_at'         => $ahora,
                'updated_at'         => $ahora,
            ];
        }

        // Insert en bloque (no un create() por fila) — con ~10 mil filas, un
        // round-trip a Supabase por fila era demasiado lento (>15 min, timeout).
        // Chunks acotados por el límite de ~65535 parámetros por sentencia de
        // Postgres (mismo criterio que AntSiniestrosImporter::UPSERT_BATCH_SIZE).
        DB::transaction(function () use ($toInsert): void {
            AntAccident::query()->delete();
            foreach (array_chunk($toInsert, 2000) as $batch) {
                DB::table('ant_accidents')->insert($batch);
            }
        });

        $this->info('Importados ' . count($toInsert) . ' siniestros.');
        if ($omitidos > 0) {
            $this->warn("Omitidos {$omitidos} sin coordenadas o inválidas.");
        }

        return self::SUCCESS;
    }
}
