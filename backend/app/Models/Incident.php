<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Incident extends Model
{
    /** @use HasFactory<\Database\Factories\IncidentFactory> */
    use HasFactory;

    protected $fillable = [
        'title',
        'type',
        'severity',
        'description',
        'latitude',
        'longitude',
        'source',
        'video_url',
        'occurred_at',
        'status',
        'geotab_exception_event_id',
        'geotab_device_id',
        'geotab_rule_id',
        'altitude_meters',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'occurred_at' => 'datetime',
        ];
    }
}