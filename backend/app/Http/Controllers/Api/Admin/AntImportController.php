<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AntSiniestrosImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class AntImportController extends Controller
{
    /** Corre `ant:import` (histórico JSON ya extraído) en producción — Render
     * free tier no da acceso a shell. Solo admin. Uso único (carga inicial). */
    public function run(): JsonResponse
    {
        Artisan::call('ant:import');

        return response()->json(['import' => trim(Artisan::output())]);
    }

    /** Sube un archivo .xlsx de la ANT (BDD mensual) y lo importa directo —
     * reemplaza la necesidad de extraerlo a mano cada mes. Upsert por
     * `codigo`: no borra lo ya cargado, así que da igual si el archivo nuevo
     * es acumulado (año a la fecha) o solo el mes. */
    public function upload(Request $request, AntSiniestrosImporter $importer): JsonResponse
    {
        $request->validate([
            // Igual al tope real de upload_max_filesize del Dockerfile (250M)
            // — subir más que eso ya lo corta PHP antes de llegar aquí.
            'file' => ['required', 'file', 'mimes:xlsx', 'max:256000'],
        ]);

        $path = $request->file('file')->getRealPath();
        $resultado = $importer->importFromXlsx($path);

        return response()->json($resultado);
    }
}
