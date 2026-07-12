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
        // En PATCH sólo se validan los campos presentes; en POST son obligatorios.
        $required = $this->isMethod('PATCH') ? 'sometimes' : 'required';

        return [
            'title'          => [$required, 'string', 'max:160'],
            'hazard_type_id' => [$required, 'integer', 'exists:hazard_types,id'],
            'description'    => ['nullable', 'string', 'max:5000'],
            'latitude'       => [$required, 'numeric', 'between:-90,90'],
            'longitude'      => [$required, 'numeric', 'between:-180,180'],
            'source'         => [$required, 'string', Rule::in(['manual', 'google_drive', 'geotab'])],
            'video_url'      => ['nullable', 'url', 'max:2048'],
            'occurred_at'    => ['nullable', 'date'],
            'status'         => ['sometimes', 'string', Rule::in(['open', 'in_progress', 'resolved', 'archived'])],
            'note'           => ['sometimes', 'nullable', 'string', 'max:500'],
            'probability'    => ['sometimes', 'nullable', 'integer', 'between:1,5'],
            'impact'         => ['sometimes', 'nullable', 'integer', 'between:1,5'],
        ];
    }
}