<?php

namespace App\Services;

use App\Models\AntAccident;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;

/**
 * Importa la BDD de siniestros de tránsito de la ANT (hoja de datos crudos,
 * detectada por cabecera) — el archivo trae ~340 columnas (detalle por
 * víctima incluido) pero solo usamos las primeras ~72 (hasta
 * SUMA_DE_VEHICULOS).
 *
 * Medido contra un archivo real (18MB, 10,752 filas, 352 columnas) antes de
 * escribir esto: leer aunque sea SOLO la fila 1 ya cuesta ~150MB / ~45s —
 * PhpSpreadsheet parsea la tabla de shared-strings completa del archivo al
 * abrirlo, sin importar qué filas/columnas se terminen filtrando. Con eso
 * como piso fijo, cargar TODAS las filas (aunque sea con el filtro de
 * columnas) llega a ~515MB — muy por encima del memory_limit=256M del
 * Dockerfile (que a su vez ya es conservador: el free tier de Render da
 * 512MB de RAM para todo el contenedor, no solo para PHP). Por eso se lee
 * en chunks de filas — cada `$reader->load()` vuelve a pagar ese costo fijo
 * (por eso un chunk grande, no chico: menos chunks = menos veces se paga),
 * pero mantiene el pico de memoria bajo control (ver CHUNK_SIZE para los
 * números medidos).
 */
class AntSiniestrosImporter
{
    /** Última columna que nos interesa (BT = SUMA_DE_VEHICULOS). Todo lo de
     * ahí en adelante es detalle por víctima que no necesitamos. */
    private const LAST_COLUMN = 'BT';

    /** Medido contra el archivo real: un chunk aislado de 3000 filas pesa
     * ~170MB de pico; la corrida completa (setup + primer chunk, antes de
     * que la memoria se libere entre chunks) llegó a ~247MB con chunks de
     * 3800 — con margen delgado bajo el memory_limit=256M del Dockerfile.
     * 3000 dejaba más aire mientras siga siendo pocos chunks grandes (no
     * muchos chicos: el costo fijo de abrir el archivo, ~50s, se paga una
     * vez por chunk). */
    private const CHUNK_SIZE = 3000;

    /** Máximo de filas por sentencia SQL de upsert — Postgres tiene un tope
     * de ~65535 parámetros por statement; con ~25 columnas por fila esto
     * deja margen de sobra sin necesitar partir el chunk de lectura. */
    private const UPSERT_BATCH_SIZE = 2000;

    /** Excel/ODS: día 0 = este día (sistema 1900, heredado del bug de Lotus 1-2-3). */
    private const EXCEL_EPOCH = '1899-12-30';

    /** @return array{creados: int, actualizados: int, omitidos: int, total: int} */
    public function importFromXlsx(string $path): array
    {
        $sheetName = $this->findDataSheet($path);
        $totalRows = $this->totalRows($path, $sheetName);

        $lastIndex = Coordinate::columnIndexFromString(self::LAST_COLUMN);
        $filter = $this->chunkFilter($lastIndex);

        $reader = new Xlsx();
        $reader->setReadDataOnly(true);
        $reader->setReadFilter($filter);
        $reader->setLoadSheetsOnly([$sheetName]);

        // La cabecera va en su propio chunk (fila 1 sola) — barato, y separa
        // el mapeo de columnas del resto del loop.
        $filter->setRows(1, 1);
        $headerSpreadsheet = $reader->load($path);
        $header = $this->readHeader($headerSpreadsheet->getSheetByName($sheetName));
        $headerSpreadsheet->disconnectWorksheets();
        unset($headerSpreadsheet);
        // PhpSpreadsheet arma referencias circulares (celda↔hoja↔libro) que
        // el conteo de referencias de PHP no libera solo — sin esto, la
        // memoria "pico" observada entre fases queda más alta de lo real.
        gc_collect_cycles();

        $creados = 0;
        $actualizados = 0;
        $omitidos = 0;
        $total = 0;

        for ($start = 2; $start <= $totalRows; $start += self::CHUNK_SIZE) {
            $filter->setRows($start, self::CHUNK_SIZE);
            $spreadsheet = $reader->load($path);
            $sheet = $spreadsheet->getSheetByName($sheetName);

            $end = min($start + self::CHUNK_SIZE - 1, $totalRows);

            try {
                $chunk = $this->importRows($sheet, $header, $start, $end);
            } finally {
                $spreadsheet->disconnectWorksheets();
                unset($spreadsheet, $sheet);
                gc_collect_cycles();
            }

            $creados += $chunk['creados'];
            $actualizados += $chunk['actualizados'];
            $omitidos += $chunk['omitidos'];
            $total += $chunk['total'];
        }

        return ['creados' => $creados, 'actualizados' => $actualizados, 'omitidos' => $omitidos, 'total' => $total];
    }

    /** Filtro de solo cabecera (fila 1) — para `findDataSheet`, que necesita
     * los nombres de columna de cada hoja candidata y nada más. Cargar todas
     * las filas (como hacía el filtro de columnas) para esto era el bug real
     * detrás de los "Failed to fetch": duplicaba el costo de ~515MB/~95s de
     * la carga completa sin necesitarlo. */
    private function headerOnlyFilter(int $lastIndex): IReadFilter
    {
        return new class($lastIndex) implements IReadFilter {
            public function __construct(private readonly int $lastIndex) {}

            public function readCell($column, $row, $worksheetName = ''): bool
            {
                return $row === 1 && Coordinate::columnIndexFromString($column) <= $this->lastIndex;
            }
        };
    }

    /** Filtro de fila 1 (cabecera) + un rango de filas mutable — mismo
     * patrón documentado por PhpSpreadsheet para leer archivos grandes en
     * chunks (`setRows()` se llama de nuevo antes de cada `$reader->load()`). */
    private function chunkFilter(int $lastIndex): IReadFilter
    {
        return new class($lastIndex) implements IReadFilter {
            private int $startRow = 1;
            private int $endRow = 1;

            public function __construct(private readonly int $lastIndex) {}

            public function setRows(int $startRow, int $chunkSize): void
            {
                $this->startRow = $startRow;
                $this->endRow = $startRow + $chunkSize;
            }

            public function readCell($column, $row, $worksheetName = ''): bool
            {
                if (Coordinate::columnIndexFromString($column) > $this->lastIndex) {
                    return false;
                }

                return $row === 1 || ($row >= $this->startRow && $row < $this->endRow);
            }
        };
    }

    /** Encuentra la hoja de datos crudos por su cabecera (columnas LATITUD_Y /
     * LONGITUD_X), no por nombre — el nombre de la hoja puede cambiar de un
     * archivo mensual a otro (ej. "BDD_2026" vs "BDD_2027"). */
    private function findDataSheet(string $path): string
    {
        $lastIndex = Coordinate::columnIndexFromString(self::LAST_COLUMN);

        $info = IOFactory::identify($path);
        $reader = IOFactory::createReader($info);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter($this->headerOnlyFilter($lastIndex));
        $names = $reader->listWorksheetNames($path);

        foreach ($names as $name) {
            $reader->setLoadSheetsOnly([$name]);
            $spreadsheet = $reader->load($path);
            $sheet = $spreadsheet->getSheetByName($name);
            $headerRow = $sheet->rangeToArray('A1:' . self::LAST_COLUMN . '1', null, true, false)[0] ?? [];
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet, $sheet);
            gc_collect_cycles();

            if (in_array('LATITUD_Y', $headerRow, true) && in_array('LONGITUD_X', $headerRow, true)) {
                return $name;
            }
        }

        throw new RuntimeException('No se encontró una hoja con columnas LATITUD_Y/LONGITUD_X en el archivo.');
    }

    /** Cuántas filas tiene la hoja de datos — `listWorksheetInfo()` lee las
     * dimensiones declaradas del archivo sin aplicar ningún read filter
     * (a diferencia de `getHighestDataRow()` sobre una hoja ya cargada con
     * filtro, que devuelve mal el total: solo cuenta lo que el filtro dejó
     * pasar). */
    private function totalRows(string $path, string $sheetName): int
    {
        $reader = new Xlsx();
        foreach ($reader->listWorksheetInfo($path) as $info) {
            if ($info['worksheetName'] === $sheetName) {
                return (int) $info['totalRows'];
            }
        }

        throw new RuntimeException("No se pudo determinar el total de filas de la hoja {$sheetName}.");
    }

    /** @param array<string, string> $header
     * @return array{creados: int, actualizados: int, omitidos: int, total: int}
     */
    private function importRows(Worksheet $sheet, array $header, int $startRow, int $endRow): array
    {
        $epoch = Carbon::parse(self::EXCEL_EPOCH);
        $rows = [];
        $omitidos = 0;
        $total = 0;

        for ($r = $startRow; $r <= $endRow; $r++) {
            $row = $this->readRow($sheet, $header, $r);
            if ($row['codigo'] === null || $row['codigo'] === '') {
                continue;
            }
            $total++;

            $lat = $row['lat'];
            $lng = $row['lng'];
            if ($lat === null || $lng === null || $lat === '' || $lng === '') {
                $omitidos++;
                continue;
            }

            $fecha = $row['fecha_serial'] !== null && $row['fecha_serial'] !== ''
                ? $epoch->copy()->addDays((int) $row['fecha_serial'])->toDateString()
                : null;

            $hora = $row['hora_fraccion'] !== null && $row['hora_fraccion'] !== ''
                ? gmdate('H:i:s', (int) round(((float) $row['hora_fraccion']) * 86400))
                : null;

            $nd = static fn (mixed $v) => ($v === null || $v === 'ND' || $v === '') ? null : (string) $v;

            $codigo = (string) $row['codigo'];
            $rows[] = [
                'codigo'             => $codigo,
                'anio'               => (int) ($row['anio'] ?? 0),
                'fecha'              => $fecha,
                'hora'               => $hora,
                'lat'                => (float) $lat,
                'lng'                => (float) $lng,
                'dpa_provincia'      => $nd($row['dpa_provincia']),
                'provincia'          => $nd($row['provincia']),
                'dpa_canton'         => $nd($row['dpa_canton']),
                'canton'             => $nd($row['canton']),
                'dpa_parroquia'      => $nd($row['dpa_parroquia']),
                'parroquia'          => $nd($row['parroquia']),
                'direccion'          => $nd($row['direccion']),
                'zona_planificacion' => $nd($row['zona_planificacion']),
                'zona'               => $nd($row['zona']),
                'id_via'             => $nd($row['id_via']),
                'nombre_via'         => $nd($row['nombre_via']),
                'ente_control'       => $nd($row['ente_control']),
                'feriado'            => $row['feriado'] === 'SI',
                'codigo_causa'       => $nd($row['codigo_causa']),
                'causa_probable'     => $nd($row['causa_probable']),
                'tipo_siniestro'     => $nd($row['tipo_siniestro']),
                'lesionados'         => (int) ($row['lesionados'] ?? 0),
                'fallecidos'         => (int) ($row['fallecidos'] ?? 0),
                'num_vehiculos'      => (int) ($row['num_vehiculos'] ?? 0),
                'created_at'         => now(),
                'updated_at'         => now(),
            ];
        }

        $creados = 0;
        $actualizados = 0;

        // upsert() en vez de updateOrCreate() por fila — con ~10 mil filas,
        // un round-trip a Supabase por fila era el otro gran costo de tiempo
        // (aparte de la lectura del archivo). En batches acotados por el
        // límite de parámetros de Postgres, no por CHUNK_SIZE.
        foreach (array_chunk($rows, self::UPSERT_BATCH_SIZE) as $batch) {
            $batchCodigos = array_column($batch, 'codigo');
            $yaExistian = AntAccident::query()
                ->whereIn('codigo', $batchCodigos)
                ->pluck('codigo')
                ->all();

            AntAccident::query()->upsert(
                $batch,
                ['codigo'],
                ['anio', 'fecha', 'hora', 'lat', 'lng', 'dpa_provincia', 'provincia', 'dpa_canton', 'canton',
                 'dpa_parroquia', 'parroquia', 'direccion', 'zona_planificacion', 'zona', 'id_via', 'nombre_via',
                 'ente_control', 'feriado', 'codigo_causa', 'causa_probable', 'tipo_siniestro', 'lesionados',
                 'fallecidos', 'num_vehiculos', 'updated_at'],
            );

            $actualizados += count($yaExistian);
            $creados += count($batch) - count($yaExistian);
        }

        return ['creados' => $creados, 'actualizados' => $actualizados, 'omitidos' => $omitidos, 'total' => $total];
    }

    /** @return array<string, string> nombre de columna (ej. "LATITUD_Y") => letra (ej. "F") */
    private function readHeader(Worksheet $sheet): array
    {
        $row = $sheet->rangeToArray('A1:' . self::LAST_COLUMN . '1', null, true, false)[0];
        $map = [];
        foreach ($row as $i => $name) {
            if ($name === null || $name === '') {
                continue;
            }
            $map[$name] = Coordinate::stringFromColumnIndex($i + 1);
        }

        return $map;
    }

    /** @param array<string, string> $header
     * @return array<string, mixed>
     */
    private function readRow(Worksheet $sheet, array $header, int $rowNum): array
    {
        $get = function (string $col) use ($sheet, $header, $rowNum) {
            $letter = $header[$col] ?? null;

            return $letter ? $sheet->getCell("{$letter}{$rowNum}")->getValue() : null;
        };

        return [
            'anio'               => $get('ANIO'),
            'codigo'             => $get('SINIESTROS'),
            'lesionados'         => $get('LESIONADOS'),
            'fallecidos'         => $get('FALLECIDOS'),
            'ente_control'       => $get('ENTE_DE_CONTROL'),
            'lat'                => $get('LATITUD_Y'),
            'lng'                => $get('LONGITUD_X'),
            'dpa_provincia'      => $get('DPA_1'),
            'provincia'          => $get('PROVINCIA'),
            'dpa_canton'         => $get('DPA_2'),
            'canton'             => $get('CANTON'),
            'dpa_parroquia'      => $get('DPA_3'),
            'parroquia'          => $get('PARROQUIA'),
            'direccion'          => $get('DIRECCION'),
            'zona_planificacion' => $get('ZONA_PLANIFICACION'),
            'zona'               => $get('ZONA'),
            'id_via'             => $get('ID_DE_LA_VIA'),
            'nombre_via'         => $get('NOMBRE_DE_LA_VIA'),
            'fecha_serial'       => $get('FECHA'),
            'hora_fraccion'      => $get('HORA'),
            'feriado'            => $get('FERIADO'),
            'codigo_causa'       => $get('CODIGO_CAUSA'),
            'causa_probable'     => $get('CAUSA_PROBABLE'),
            'tipo_siniestro'     => $get('TIPO_DE_SINIESTRO'),
            'num_vehiculos'      => $get('SUMA_DE_VEHICULOS'),
        ];
    }
}
