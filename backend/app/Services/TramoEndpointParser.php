<?php

namespace App\Services;

class TramoEndpointParser
{
    /** Extrae los 2 extremos (inicio, fin) de un tramo a partir de su texto
     * libre (ej. "E45: Sucúa - Logroño, sector Paso Carreño, km 10" -> ["Sucúa",
     * "Logroño"]). Es una aproximación por nombres de lugar, no una referencia
     * lineal exacta por km — acordado con el cliente para el dibujo en el mapa.
     *
     * @return array{0: ?string, 1: ?string}
     */
    public function endpoints(string $tramo): array
    {
        $sinPreambulo = $this->quitarPreambuloRuta($tramo);
        // Algunos tramos repiten "Vía " tanto antes del código de ruta como
        // antes del nombre de lugar (ej. "Vía E385, Vía La Concordia - ...").
        $sinPreambulo = preg_replace('/^v[ií]a\s+/iu', '', $sinPreambulo) ?? $sinPreambulo;
        // Algunos tramos repiten el código de ruta una 2a vez antes del lugar
        // real (ej. "E30: Vía E30, Baños-Puyo..."), lo que sin este paso deja
        // "E30" como si fuera el nombre del lugar a geocodificar.
        $sinPreambulo = preg_replace('/^e-?\d{2,3}[a-z]?,\s*/iu', '', $sinPreambulo) ?? $sinPreambulo;
        // Coma suelta justo después del prefijo (ej. "Vía , \"Y\" Rocafuerte...",
        // un artefacto de formato del boletín) — sin esto, hastaPrimerSeparador
        // corta en esa coma y descarta el lugar real que viene después.
        $sinPreambulo = preg_replace('/^,\s*/u', '', $sinPreambulo) ?? $sinPreambulo;

        $descripcion = $this->hastaPrimerSeparador($sinPreambulo);
        $lugares = $this->dividirLugares($descripcion);

        // Los km sueltos ("Km 8", "km 84+100 lado derecho") no son lugares
        // geocodificables; se descartan para no usarlos como extremo del tramo.
        $lugares = array_values(array_filter(
            $lugares,
            static fn (string $l) => !preg_match('/^km\.?\s*\d/iu', $l),
        ));

        if ($lugares === []) {
            return [null, null];
        }

        return [$lugares[0], $lugares[count($lugares) - 1]];
    }

    /** Quita el prefijo de código de ruta y palabras de relleno
     * ("Vía cerrada: Vía E582, ", "E45:", "E25 –E68:", etc). */
    private function quitarPreambuloRuta(string $tramo): string
    {
        // El prefijo "cerrada"/"vía" puede repetirse y en cualquier orden antes
        // del código de ruta (ej. "Cerrada. Vía E25,", "Vía cerrada: Vía E50,").
        // Sin el `*` (antes `?` una sola vez), "Cerrada. Vía E25," no matcheaba
        // nada y "Cerrada" quedaba como si fuera el nombre del lugar a geocodificar
        // (Google la resolvía a una calle "Cerrada" en México, un nombre de calle
        // común allá — coordenadas completamente fuera de Ecuador).
        $patron = '/^(?:(?:v[ií]a\s+)?cerrad[oa][:.,]?\s*)*(?:v[ií]a\s+)?'
            . 'e-?\d{2,3}[a-z]?(?:\s*[\/,–-]\s*e-?\d{2,3}[a-z]?)?\s*[:,]?\s*(?:tramo\s+)?/iu';

        $resultado = preg_replace($patron, '', trim($tramo));

        return $resultado !== null ? trim($resultado) : trim($tramo);
    }

    /** Se queda con el texto antes del primer punto o coma (los detalles de
     * km/sector siempre vienen después en los boletines). */
    private function hastaPrimerSeparador(string $texto): string
    {
        // Protege abreviaturas comunes con punto ("Sto."/"Sta." = Santo/Santa,
        // usadas en nombres reales como "Sto. Domingo") para que ese punto no
        // se confunda con el separador real de la descripción — sin esto,
        // "Sto. Domingo - Quevedo" se cortaba en "Sto." y perdía el lugar real.
        $protegido = preg_replace('/\b(Sto|Sta)\./iu', '$1@', $texto) ?? $texto;

        $posiciones = [mb_strpos($protegido, ','), mb_strpos($protegido, '.'), mb_strpos($protegido, ':')];
        $limites = array_filter($posiciones, static fn ($p) => $p !== false);

        $cortado = $limites === [] ? $protegido : mb_substr($protegido, 0, min($limites));

        return trim(str_replace('@', '.', $cortado));
    }

    /** @return list<string> */
    private function dividirLugares(string $descripcion): array
    {
        if (trim($descripcion) === '') {
            return [];
        }

        // Espacio opcional a los lados del guion: el boletín no siempre separa
        // los 2 lugares con espacios (ej. "Salinas-Lita" en vez de "Salinas - Lita"),
        // y sin este ajuste el par completo quedaba como un solo token no geocodificable.
        $partes = preg_split('/\s*[-–]\s*/u', $descripcion);
        $partes = $partes !== false ? $partes : [$descripcion];

        return array_values(array_filter(
            array_map(static fn ($p) => trim((string) preg_replace('/\s*\([^)]*\)\s*$/u', '', trim($p))), $partes),
            static fn ($p) => $p !== '',
        ));
    }
}
