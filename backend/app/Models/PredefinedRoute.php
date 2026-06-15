<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['nombre', 'descripcion', 'origen', 'destino', 'activo'])]
class PredefinedRoute extends Model
{
    protected function casts(): array
    {
        return [
            'activo' => 'boolean',
        ];
    }
}
