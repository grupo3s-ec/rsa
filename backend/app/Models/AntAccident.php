<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AntAccident extends Model
{
    protected $fillable = [
        'codigo',
        'anio',
        'fecha',
        'hora',
        'lat',
        'lng',
        'dpa_provincia',
        'provincia',
        'dpa_canton',
        'canton',
        'dpa_parroquia',
        'parroquia',
        'direccion',
        'zona_planificacion',
        'zona',
        'id_via',
        'nombre_via',
        'ente_control',
        'feriado',
        'codigo_causa',
        'causa_probable',
        'tipo_siniestro',
        'lesionados',
        'fallecidos',
        'num_vehiculos',
    ];

    protected function casts(): array
    {
        return [
            'fecha'         => 'date',
            // 'float', no 'decimal:7' — el cast decimal serializa a JSON
            // como string (a propósito, para no perder precisión), y el
            // frontend espera un number tal cual (mismo criterio que
            // MitAdverseEvent, que ya usa 'float' por esto mismo).
            'lat'           => 'float',
            'lng'           => 'float',
            'feriado'       => 'boolean',
            'lesionados'    => 'integer',
            'fallecidos'    => 'integer',
            'num_vehiculos' => 'integer',
        ];
    }
}
