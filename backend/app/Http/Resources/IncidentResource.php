<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Incident
 */
class IncidentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                        => $this->id,
            'title'                     => $this->title,
            'type'                      => $this->type,
            'severity'                  => $this->severity,
            'description'               => $this->description,
            'latitude'                  => (float) $this->latitude,
            'longitude'                 => (float) $this->longitude,
            'source'                    => $this->source,
            'video_url'                 => $this->video_url,
            'occurred_at'               => $this->occurred_at?->toISOString(),
            'status'                    => $this->status,
            'geotab_exception_event_id' => $this->geotab_exception_event_id,
            'geotab_device_id'          => $this->geotab_device_id,
            'geotab_rule_id'            => $this->geotab_rule_id,
            'altitude_meters'           => $this->altitude_meters !== null ? (float) $this->altitude_meters : null,
            'created_at'                => $this->created_at?->toISOString(),
            'updated_at'                => $this->updated_at?->toISOString(),
        ];
    }
}