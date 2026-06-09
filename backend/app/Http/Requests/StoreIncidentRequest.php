<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreIncidentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'type' => [
                'required',
                'string',
                Rule::in([
                    'accident',
                    'road_damage',
                    'landslide',
                    'closure',
                    'risk',
                    'checkpoint',
                    'assistance',
                ]),
            ],
            'severity' => [
                'required',
                'string',
                Rule::in(['low', 'medium', 'high', 'critical']),
            ],
            'description' => ['nullable', 'string', 'max:5000'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'source' => [
                'required',
                'string',
                Rule::in(['manual', 'google_drive', 'geotab']),
            ],
            'video_url' => ['nullable', 'url', 'max:2048'],
            'occurred_at' => ['nullable', 'date'],
            'status' => [
                'sometimes',
                'string',
                Rule::in(['open', 'in_progress', 'resolved', 'archived']),
            ],
        ];
    }
}