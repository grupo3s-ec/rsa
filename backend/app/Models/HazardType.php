<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HazardType extends Model
{
    /** @use HasFactory<\Database\Factories\HazardTypeFactory> */
    use HasFactory;

    protected $fillable = [
        'condition',
        'name',
        'risks',
        'severity',
    ];

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class);
    }
}
