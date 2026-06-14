<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\RouteIncidentController;
use Illuminate\Support\Facades\Route;

// ── Autenticación (pública) ───────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);

// ── Rutas protegidas ──────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',     [AuthController::class, 'me']);

    // Incidentes
    Route::get('/incidents',           [IncidentController::class, 'index']);
    Route::get('/incidents/{incident}', [IncidentController::class, 'show']);
    Route::post('/incidents',          [IncidentController::class, 'store']);
    Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('/incidents/{incident}', [IncidentController::class, 'destroy']);

    // Incidentes por ruta
    Route::get('/routes/incidents', RouteIncidentController::class);
});
