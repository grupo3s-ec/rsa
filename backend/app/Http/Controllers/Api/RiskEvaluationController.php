<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RiskEvaluationKmResource;
use App\Models\RiskEvaluation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskEvaluationController extends Controller
{
    /** Kms de evaluación de riesgo — por defecto la primera (y hoy única)
     * evaluación cargada; `evaluation_id` permite elegir otra si en el
     * futuro hay más de una ruta evaluada. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'evaluation_id' => ['sometimes', 'integer'],
        ]);

        $evaluation = isset($data['evaluation_id'])
            ? RiskEvaluation::query()->find($data['evaluation_id'])
            : RiskEvaluation::query()->orderBy('id')->first();

        if (!$evaluation) {
            return response()->json(['evaluation' => null, 'kms' => []]);
        }

        $kms = $evaluation->kms()->orderBy('km_number')->get();

        return response()->json([
            'evaluation' => ['id' => $evaluation->id, 'nombre' => $evaluation->nombre],
            'kms' => RiskEvaluationKmResource::collection($kms),
        ]);
    }
}
