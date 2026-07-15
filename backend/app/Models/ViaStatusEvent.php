<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ViaStatusEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'via_ecu911_id',
        'descripcion',
        'provincia',
        'canton',
        'estado_anterior_id',
        'estado_actual_id',
        'estado_actual_nombre',
        'observaciones',
        'via_modified_at',
        'detected_at',
    ];

    protected function casts(): array
    {
        return [
            'via_modified_at' => 'datetime',
            'detected_at'     => 'datetime',
        ];
    }
}
