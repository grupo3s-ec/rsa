<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\RiskEvaluationOdsParser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskEvaluationImportController extends Controller
{
    /** Sube un .ods de "Evaluación de Riesgo" y lo importa — upsert por km
     * (número de km dentro de esa evaluación), así que volver a subir el
     * mismo archivo actualizado no duplica filas. */
    public function upload(Request $request, RiskEvaluationOdsParser $parser): JsonResponse
    {
        $data = $request->validate([
            'file'   => ['required', 'file', 'mimes:ods', 'max:51200'], // 50 MB
            'nombre' => ['required', 'string', 'max:160'],
        ]);

        $resultado = $parser->importFromOds($request->file('file')->getRealPath(), $data['nombre']);

        return response()->json([
            'evaluation_id' => $resultado['evaluation']->id,
            'nombre'        => $resultado['evaluation']->nombre,
            'kms'           => $resultado['kms'],
        ]);
    }
}
