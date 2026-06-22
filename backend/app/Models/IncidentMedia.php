<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentMedia extends Model
{
    protected $fillable = [
        'incident_id',
        'media_type',
        'url',
        'thumbnail_url',
        'geotab_media_file_id',
        'file_name',
        'file_size',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }
}
