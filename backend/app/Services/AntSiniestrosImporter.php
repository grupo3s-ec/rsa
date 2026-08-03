<?php

namespace App\Services;

use App\Models\AntAccident;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\IReadFilter;
use PhpOffice\PhpSpreadsheet\Reader\Xlsx;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;

/**
 * Importa la BDD de siniestros de tránsito de la ANT (hoja de datos crudos,
 * detectada por cabecera) — el archivo trae ~340 columnas (detalle por
 * víctima incluido) pero solo usamos las primeras ~72 (hasta
 * SUMA_DE_VEHICULOS); el resto se descarta con un read filter para no
 * cargarlo en memoria (el archivo mensual puede pesar 100+ MB, Render free
 * tier tiene poca RAM).
 */
class AntSiniestrosImporter
{
    /** Última columna que nos interesa (BT = SUMA_DE_VEHICULOS). Todo lo de
     * ahí en adelante es detalle por víctima que no necesitamos. */
    private const LAST_COLUMN = 'BT';

    /** Excel/ODS: día 0 = este día (sistema 1900, heredado del bug de Lotus 1-2-3). */
    private const EXCEL_EPOCH = '1899-12-30';

    /** @return array{creados: int, actualizados: int, omitidos: int, total: int} */
    public function importFromXlsx(string $path): array
    {
        $sheetName = $this->findDataSheet($path);

        $reader = new Xlsx();
        $reader->setReadDataOnly(true);
        $reader->setReadFilter($this->columnFilter());
        $reader->setLoadSheetsOnly([$sheetName]);
        $spreadsheet = $reader->load($path);
        $sheet = $spreadsheet->getSheetByName($sheetName);

        try {
            return $this->importSheet($sheet);
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    private function columnFilter(): IReadFilter
    {
        // Comparar letras de columna con `<=` es comparación de strings, no
        // de índice ("C" <= "BT" es FALSE porque "C" > "B" alfabéticamente)
        // — con eso, todas las columnas de una sola letra entre C y Z quedan
        // excluidas y sus celdas (incluida LATITUD_Y/LONGITUD_X) devuelven
        // null. Hay que comparar por índice numérico de columna.
        $lastIndex = Coordinate::columnIndexFromString(self::LAST_COLUMN);

        return new class($lastIndex) implements IReadFilter {
            public function __construct(private readonly int $lastIndex) {}

            public function readCell($column, $row, $worksheetName = ''): bool
            {
                return $row === 1 || Coordinate::columnIndexFromString($column) <= $this->lastIndex;
            }
        };
    }

    /** Encuentra la hoja de datos crudos por su cabecera (columnas LATITUD_Y /
     * LONGITUD_X), no por nombre — el nombre de la hoja puede cambiar de un
     * archivo mensual a otro (ej. "BDD_2026" vs "BDD_2027"). */
    private function findDataSheet(string $path): string
    {
        $info = IOFactory::identify($path);
        $reader = IOFactory::createReader($info);
        $reader->setReadDataOnly(true);
        $reader->setReadFilter($this->columnFilter());
        $names = $reader->listWorksheetNames($path);

        foreach ($names as $name) {
            $reader->setLoadSheetsOnly([$name]);
            $spreadsheet = $reader->load($path);
            $sheet = $spreadsheet->getSheetByName($name);
            $headerRow = $sheet->rangeToArray('A1:' . self::LAST_COLUMN . '1', null, true, false)[0] ?? [];
            $spreadsheet->disconnectWorksheets();

            if (in_array('LATITUD_Y', $headerRow, true) && in_array('LONGITUD_X', $headerRow, true)) {
                return $name;
            }
        }

        throw new RuntimeException('No se encontró una hoja con columnas LATITUD_Y/LONGITUD_X en el archivo.');
    }

    /** @return array{creados: int, actualizados: int, omitidos: int, total: int} */
    private function importSheet(Worksheet $sheet): array
    {
        $header = $this->readHeader($sheet);
        $epoch = Carbon::parse(self::EXCEL_EPOCH);

        $creados = 0;
        $actualizados = 0;
        $omitidos = 0;
        $total = 0;

        $highestRow = $sheet->getHighestDataRow();
        for ($r = 2; $r <= $highestRow; $r++) {
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

            $accident = AntAccident::query()->updateOrCreate(
                ['codigo' => (string) $row['codigo']],
                [
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
                ],
            );

            $accident->wasRecentlyCreated ? $creados++ : $actualizados++;
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
