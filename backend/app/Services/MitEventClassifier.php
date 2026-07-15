<?php

namespace App\Services;

class MitEventClassifier
{
    /** Taxonomía de tipo_evento, en orden de prioridad: la primera categoría
     * cuyas palabras clave aparecen en el texto es la que se asigna. Basada
     * en los términos reales usados en los boletines MTOP/MIT (deslizamientos,
     * socavamientos, etc.), no en la tabla de iconos de gravedad de otro
     * documento (esa es una taxonomía distinta, ya implementada aparte). */
    private const CATEGORIAS = [
        'Cierre por conflicto social' => ['planton', 'paro', 'huelga', 'manifestantes', 'cerrada por la comunidad', 'cerrada por pobladores'],
        'Colapso de puente/alcantarilla' => ['colapso de puente', 'colapso del puente', 'colapso de alcantarilla', 'colapso de cabezal', 'afectacion del puente', 'afectacion de puente', 'base del puente', 'bases del puente', 'socavacion del estribo', 'colapso de vía y puente', 'colapso de via y puente'],
        'Caída de rocas' => ['caida de rocas', 'desprendimiento de rocas', 'derrumbe de rocas', 'material rocoso'],
        'Caída de árboles' => ['caida de arbol', 'caida de arboles', 'arboles caidos', 'arbol caido'],
        'Deslizamiento/Derrumbe' => ['deslizamiento', 'derrumbe', 'deslave'],
        'Socavamiento/Socavón' => ['socavamiento', 'socavon', 'socavacion'],
        'Pérdida de calzada' => ['perdida de la mesa', 'perdida de mesa', 'perdida de la calzada', 'perdida de calzada', 'perdida de la seccion transversal', 'perdida de via', 'afectacion de la mesa', 'afectacion de mesa'],
        'Hundimiento' => ['hundimiento', 'asentamiento'],
        'Falla geológica' => ['falla geologica'],
        'Inundación/Nivel de agua' => ['inundacion', 'nivel de agua', 'lechugines'],
        'Trabajos programados/Mantenimiento' => ['cambio de alcantarilla', 'trabajos programados', 'bacheo', 'tendido de asfalto', 'limpieza de drenaje', 'limpieza de sistemas de drenaje'],
    ];

    private const DEFAULT_CATEGORIA = 'Otro';

    /** Taxonomía completa de tipo_evento, para poblar el filtro del frontend
     * sin tener que hacer un SELECT DISTINCT (incluye categorías aunque no
     * tengan filas en un momento dado).
     *
     * @return list<string>
     */
    public static function tiposEvento(): array
    {
        return [...array_keys(self::CATEGORIAS), self::DEFAULT_CATEGORIA];
    }

    /** Clasifica un evento en una categoría de tipo_evento a partir de su
     * texto libre (columna EVENTO, más ACCIONES REALIZADAS como refuerzo). */
    public function tipoEvento(string $evento, ?string $accionesRealizadas = null): string
    {
        $texto = $this->normalizar($evento . ' ' . ($accionesRealizadas ?? ''));

        foreach (self::CATEGORIAS as $categoria => $palabrasClave) {
            foreach ($palabrasClave as $palabra) {
                // \b SOLO al inicio (no al final): evita que "paro" coincida
                // dentro de "amparo"/"reparo" (no hay límite de palabra entre
                // 'm'/'r' y 'p', así que no matchea ahí), pero SÍ debe matchear
                // dentro de plurales como "derrumbes"/"deslizamientos" — un \b
                // también al final rompía eso (no hay límite de palabra entre
                // "o" y la "s" del plural), lo que de hecho triplicó "Otro" en
                // la primera versión de este fix, antes de detectarlo con datos reales.
                if (preg_match('/\b' . preg_quote($palabra, '/') . '/u', $texto)) {
                    return $categoria;
                }
            }
        }

        return self::DEFAULT_CATEGORIA;
    }

    /** Extrae los códigos de ruta (ej. "E45", "E582", "E35A") del texto libre
     * de la columna TRAMO. Algunos tramos mencionan 2 rutas (ej. "E20/E45");
     * se devuelven todas las distintas, unidas por ", " — null si no hay ninguna. */
    public function rutaCodigo(string $tramo): ?string
    {
        if (!preg_match_all('/\bE-?\d{2,3}[A-Z]?\b/', strtoupper($tramo), $matches)) {
            return null;
        }

        $codigos = array_values(array_unique(array_map(
            static fn (string $m) => str_replace('-', '', $m),
            $matches[0],
        )));

        return implode(', ', $codigos);
    }

    /** Quita acentos con un mapa explícito en vez de iconv//TRANSLIT: ese
     * transliterador depende de los módulos gconv instalados en el sistema y
     * en algunos entornos (confirmado localmente) inserta apóstrofes en vez
     * de solo quitar el acento (ej. "pérdida" -> "p'erdida"), lo que rompía
     * silenciosamente todas las coincidencias de palabras clave acentuadas. */
    private function normalizar(string $texto): string
    {
        $mapa = [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u',
            'ñ' => 'n', 'ü' => 'u',
        ];

        return strtr(mb_strtolower($texto), $mapa);
    }
}
