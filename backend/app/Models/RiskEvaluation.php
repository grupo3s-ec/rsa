<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RiskEvaluation extends Model
{
    protected $fillable = ['nombre'];

    public function kms(): HasMany
    {
        return $this->hasMany(RiskEvaluationKm::class);
    }
}
