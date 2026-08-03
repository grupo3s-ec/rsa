<?php

namespace App\Services;

use App\Models\RiskEvaluation;
use App\Models\RiskEvaluationKm;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;

/**
 * Importa el archivo .ods de "Evaluación de Riesgo" (levantamiento en campo,
 * 1 fila por km) — trae 4 hojas: la tabla principal por km, el catálogo de
 * riesgos por tipo de condición (con su imagen de señalética), y 2 tablas de
 * enlaces (video y señalética) que la tabla principal referencia por nombre
 * de archivo. Las hojas se identifican por su cabecera, no por nombre — el
 * archivo lo mantiene el equipo de campo y el nombre exacto de cada hoja
 * puede variar de una versión a otra.
 *
 * Layout de la hoja principal (por índice de columna, 0-based) — ver hallazgo
 * documentado: 5 "slots" de condición (6/12/17/22/27), cada uno con
 * CONDICIÓN/TIPO DE CONDICIÓN/RIESGOS/IMPACTO/Señalética(rota, se ignora).
 */
class RiskEvaluationOdsParser
{
    private const COL_KM          = 0;
    private const COL_LAT         = 1;
    private const COL_LNG         = 2;
    private const COL_FECHA_VIDEO = 3;
    private const COL_VIDEO       = 4;
    // 5 = link de video roto en el archivo fuente, se resuelve vía Links_VIdeos.
    private const COL_COMENTARIO  = 32;

    /** Offset de columna de cada slot de condición, relativo a su bloque de 5
     * (CONDICIÓN, TIPO_DE_CONDICION, RIESGOS, IMPACTO, Señalética-ignorada). */
    private const SLOT_STARTS = [6, 12, 17, 22, 27];

    /** Solo el primer slot trae "TIPO CAMINO" (dato de la fila, no de la
     * condición) intercalado entre CONDICIÓN y TIPO DE CONDICIÓN. */
    private const COL_TIPO_CAMINO = 7;

    /**
     * @return array{evaluation: RiskEvaluation, kms: int}
     */
    public function importFromOds(string $path, string $nombre): array
    {
        $reader = IOFactory::createReader('Ods');
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);

        try {
            $principal = $this->findSheet($spreadsheet, fn (array $h) => $this->headerHas($h, 'kil') && $this->headerHas($h, 'latitud'));
            $tablaRiesgos = $this->findSheet($spreadsheet, fn (array $h) => $this->headerHas($h, 'tipo de condici') && $this->headerHas($h, 'impacto') && $this->headerHas($h, 'link'));
            $linksVideos = $this->findSheet($spreadsheet, fn (array $h) => $this->headerHas($h, 'nombre del archivo') && $this->headerHas($h, 'enlace de drive') && !$this->headerHas($h, 'ndici'));
            $linksSenaletica = $this->findSheet($spreadsheet, fn (array $h) => $this->headerHas($h, 'nombre del archivo') && $this->headerHas($h, 'enlace de drive') && $this->headerHas($h, 'ndici'));

            if (!$principal) {
                throw new RuntimeException('No se encontró la hoja principal (columnas Kilómetro/Latitud) en el archivo.');
            }

            $imagenPorCondicionTipo = $tablaRiesgos ? $this->buildImagenLookup($tablaRiesgos) : [];
            $imagenPorArchivo = $linksSenaletica ? $this->buildArchivoLookup($linksSenaletica, 2) : [];
            $videoPorArchivo = $linksVideos ? $this->buildArchivoLookup($linksVideos, null) : [];

            $evaluation = RiskEvaluation::query()->updateOrCreate(['nombre' => $nombre]);

            $count = $this->importPrincipal($principal, $evaluation, $videoPorArchivo, $imagenPorCondicionTipo, $imagenPorArchivo);

            return ['evaluation' => $evaluation, 'kms' => $count];
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    /** @param callable(array<int, string>): bool $matches */
    private function findSheet(\PhpOffice\PhpSpreadsheet\Spreadsheet $spreadsheet, callable $matches): ?Worksheet
    {
        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $header = $sheet->rangeToArray('A1:AH1', null, true, false)[0] ?? [];
            $header = array_map(static fn ($v) => Str::lower((string) ($v ?? '')), $header);
            if ($matches($header)) {
                return $sheet;
            }
        }

        return null;
    }

    /** @param array<int, string> $header */
    private function headerHas(array $header, string $needle): bool
    {
        foreach ($header as $cell) {
            if (str_contains($cell, $needle)) {
                return true;
            }
        }

        return false;
    }

    /** Catálogo "Tabla_Riesgos": (condición, tipo de condición) → link de
     * imagen de señalética. Normaliza claves para no fallar por
     * mayúsculas/espacios entre el catálogo y la tabla principal.
     *
     * @return array<string, string>
     */
    private function buildImagenLookup(Worksheet $sheet): array
    {
        $rows = $sheet->toArray(null, true, false, false);
        $lookup = [];
        foreach (array_slice($rows, 1) as $row) {
            $condicion = trim((string) ($row[0] ?? ''));
            $tipo      = trim((string) ($row[1] ?? ''));
            $link      = trim((string) ($row[5] ?? ''));
            if ($condicion === '' || $tipo === '' || $link === '' || !str_starts_with($link, 'http')) {
                continue;
            }
            $lookup[$this->key($condicion, $tipo)] = $link;
        }

        return $lookup;
    }

    /** Lookup genérico "nombre de archivo" → "enlace de Drive", para
     * Links_VIdeos y Links_Señaletica (mismas 2 primeras columnas).
     *
     * @return array<string, string>
     */
    private function buildArchivoLookup(Worksheet $sheet, ?int $unused): array
    {
        $rows = $sheet->toArray(null, true, false, false);
        $lookup = [];
        foreach (array_slice($rows, 1) as $row) {
            $archivo = trim((string) ($row[0] ?? ''));
            $link    = trim((string) ($row[1] ?? ''));
            if ($archivo === '' || $link === '' || !str_starts_with($link, 'http')) {
                continue;
            }
            $lookup[Str::lower($archivo)] = $link;
        }

        return $lookup;
    }

    private function key(string $condicion, string $tipo): string
    {
        return Str::lower(trim($condicion)) . '|' . Str::lower(trim($tipo));
    }

    /**
     * @param array<string, string> $videoPorArchivo
     * @param array<string, string> $imagenPorCondicionTipo
     * @param array<string, string> $imagenPorArchivo
     */
    private function importPrincipal(
        Worksheet $sheet,
        RiskEvaluation $evaluation,
        array $videoPorArchivo,
        array $imagenPorCondicionTipo,
        array $imagenPorArchivo,
    ): int {
        $rows = $sheet->toArray(null, true, false, false);
        $count = 0;

        foreach (array_slice($rows, 1) as $row) {
            $kmLabel = trim((string) ($row[self::COL_KM] ?? ''));
            if ($kmLabel === '' || !preg_match('/(\d+)/', $kmLabel, $m)) {
                continue;
            }
            $kmNumber = (int) $m[1];

            $lat = $this->parseDecimal($row[self::COL_LAT] ?? null);
            $lng = $this->parseDecimal($row[self::COL_LNG] ?? null);
            if ($lat === null || $lng === null) {
                continue;
            }

            $videoFilename = trim((string) ($row[self::COL_VIDEO] ?? ''));
            $videoUrl = $videoFilename !== '' ? ($videoPorArchivo[Str::lower($videoFilename)] ?? null) : null;

            $fechaVideo = $this->parseFechaHora((string) ($row[self::COL_FECHA_VIDEO] ?? ''));

            $tipoCamino = trim((string) ($row[self::COL_TIPO_CAMINO] ?? '')) ?: null;

            $conditions = [];
            foreach (self::SLOT_STARTS as $i => $start) {
                // Solo el 1er slot tiene la columna extra TIPO_CAMINO metida en
                // medio — desplaza en 1 el resto de columnas del slot.
                $offset = $i === 0 ? 1 : 0;
                $condicion = trim((string) ($row[$start] ?? ''));
                if ($condicion === '') {
                    continue;
                }
                $tipo     = trim((string) ($row[$start + 1 + $offset] ?? ''));
                $riesgos  = trim((string) ($row[$start + 2 + $offset] ?? ''));
                $impacto  = trim((string) ($row[$start + 3 + $offset] ?? ''));

                $imagenUrl = $imagenPorCondicionTipo[$this->key($condicion, $tipo)] ?? null;
                if (!$imagenUrl && $tipo !== '') {
                    $imagenUrl = $imagenPorArchivo[Str::lower($tipo) . '.png'] ?? null;
                }

                $conditions[] = [
                    'condicion'   => $condicion,
                    'tipo'        => $tipo,
                    'riesgos'     => $riesgos ?: null,
                    'impacto'     => $impacto ?: null,
                    'imagen_url'  => $imagenUrl,
                ];
            }

            RiskEvaluationKm::query()->updateOrCreate(
                ['risk_evaluation_id' => $evaluation->id, 'km_number' => $kmNumber],
                [
                    'km_label'     => $kmLabel,
                    'lat'          => $lat,
                    'lng'          => $lng,
                    'fecha_video'  => $fechaVideo,
                    'video_filename' => $videoFilename ?: null,
                    'video_url'    => $videoUrl,
                    'tipo_camino'  => $tipoCamino,
                    'comentario'   => trim((string) ($row[self::COL_COMENTARIO] ?? '')) ?: null,
                    'conditions'   => $conditions,
                ],
            );
            $count++;
        }

        return $count;
    }

    private function parseDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        $normalized = str_replace(',', '.', trim((string) $value));

        return is_numeric($normalized) ? (float) $normalized : null;
    }

    private function parseFechaHora(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }
        foreach (['d/m/Y H:i', 'd/m/Y G:i'] as $format) {
            try {
                return Carbon::createFromFormat($format, $value)->toDateTimeString();
            } catch (\Throwable) {
                continue;
            }
        }

        return null;
    }
}
