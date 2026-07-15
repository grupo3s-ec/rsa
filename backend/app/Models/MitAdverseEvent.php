<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MitAdverseEvent extends Model
{
    protected $fillable = [
        'region',
        'provincia',
        'fecha_periodo_texto',
        'tramo',
        'evento',
        'acciones_realizadas',
        'observaciones',
        'recomendaciones',
        'ruta_codigo',
        'tipo_evento',
        'fecha_evento_inicio',
        'fecha_evento_fin',
        'inicio_lat',
        'inicio_lng',
        'fin_lat',
        'fin_lng',
        'geocoding_status',
        'fuente_nombre',
        'fuente_boletin',
        'boletin_mes',
        'boletin_anio',
    ];

    protected function casts(): array
    {
        return [
            'region'              => 'integer',
            'fecha_evento_inicio' => 'date',
            'fecha_evento_fin'    => 'date',
            'inicio_lat'          => 'float',
            'inicio_lng'          => 'float',
            'fin_lat'             => 'float',
            'fin_lng'             => 'float',
            'boletin_mes'         => 'integer',
            'boletin_anio'        => 'integer',
        ];
    }
}
