<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['placa', 'marca', 'modelo', 'anio', 'activo'])]
class Vehicle extends Model
{
    protected function casts(): array
    {
        return [
            'anio'   => 'integer',
            'activo' => 'boolean',
        ];
    }
}
