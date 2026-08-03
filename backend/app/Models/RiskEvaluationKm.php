<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskEvaluationKm extends Model
{
    protected $fillable = [
        'risk_evaluation_id',
        'km_label',
        'km_number',
        'lat',
        'lng',
        'fecha_video',
        'video_filename',
        'video_url',
        'tipo_camino',
        'comentario',
        'conditions',
    ];

    protected function casts(): array
    {
        return [
            'lat'         => 'decimal:7',
            'lng'         => 'decimal:7',
            'fecha_video' => 'datetime',
            'conditions'  => 'array',
        ];
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(RiskEvaluation::class, 'risk_evaluation_id');
    }
}
