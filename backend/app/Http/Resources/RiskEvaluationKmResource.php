<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\RiskEvaluationKm
 */
class RiskEvaluationKmResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'risk_evaluation_id' => $this->risk_evaluation_id,
            'km_label'        => $this->km_label,
            'km_number'       => $this->km_number,
            'lat'             => (float) $this->lat,
            'lng'             => (float) $this->lng,
            'fecha_video'     => $this->fecha_video?->toISOString(),
            'video_filename'  => $this->video_filename,
            'video_url'       => $this->video_url,
            'tipo_camino'     => $this->tipo_camino,
            'comentario'      => $this->comentario,
            'conditions'      => $this->conditions,
        ];
    }
}
