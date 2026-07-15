<?php

use App\Http\Controllers\Api\Admin\AuditController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\GeotabController;
use App\Http\Controllers\Api\Admin\MitImportController;
use App\Http\Controllers\Api\Admin\PredefinedRouteController as AdminRouteController;
use App\Http\Controllers\Api\Admin\ReportController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\Admin\VehicleController as AdminVehicleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HazardTypeController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\IncidentMediaController;
use App\Http\Controllers\Api\MitAdverseEventController;
use App\Http\Controllers\Api\RouteIncidentController;
use App\Http\Controllers\Api\ViaHistoryController;
use Illuminate\Support\Facades\Route;

// ── Ping público (warmup para Render free tier) ──────────────────────────────
Route::get('/ping', fn () => response()->json(['ok' => true]));

// ── Autenticación (pública) ───────────────────────────────────────────────────
Route::post('/auth/login', [AuthController::class, 'login']);

// ── Poll de vías ECU911 (público, protegido por token compartido) ───────────
// Pensado para ser disparado por un cron externo (ej. cron-job.org) cada
// 15-30 min — no requiere sesión de usuario. Ver services.via_poll.token.
Route::post('/vias/poll', [ViaHistoryController::class, 'poll']);

// ── Rutas protegidas ──────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',     [AuthController::class, 'me']);

    // Catálogo de peligros (para el select de tipo de incidente)
    Route::get('/hazard-types', [HazardTypeController::class, 'index']);

    // Incidentes
    Route::get('/incidents',              [IncidentController::class, 'index']);
    Route::post('/incidents',             [IncidentController::class, 'store']);
    Route::get('/incidents/{incident}',   [IncidentController::class, 'show']);
    Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('/incidents/{incident}',[IncidentController::class, 'destroy']);
    Route::get('/incidents/{incident}/history', [IncidentController::class, 'history']);

    // Evidencias de incidentes
    Route::get('/incidents/{incident}/media',               [IncidentMediaController::class, 'index']);
    Route::post('/incidents/{incident}/media',              [IncidentMediaController::class, 'store']);
    Route::post('/incidents/{incident}/media/upload',       [IncidentMediaController::class, 'upload']);
    Route::delete('/incidents/{incident}/media/{media}',    [IncidentMediaController::class, 'destroy']);

    // Incidentes por ruta
    Route::get('/routes/incidents', RouteIncidentController::class);

    // Histórico de cierres viales (ECU911)
    Route::get('/vias/history', [ViaHistoryController::class, 'index']);

    // Histórico de eventos adversos MTOP/MIT (boletines mensuales)
    Route::get('/mit/eventos-adversos',           [MitAdverseEventController::class, 'index']);
    Route::get('/mit/eventos-adversos/opciones',  [MitAdverseEventController::class, 'opciones']);

    // ── Dashboard y Geotab (admin + operator) ────────────────────────────────
    Route::middleware('operator')->prefix('admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::get('/geotab/status',  [GeotabController::class, 'status']);
        Route::get('/geotab/devices', [GeotabController::class, 'devices']);
        Route::post('/geotab/sync',   [GeotabController::class, 'sync']);
    });

    // ── Administración (solo admin) ───────────────────────────────────────────
    Route::middleware('admin')->prefix('admin')->group(function () {

        // Reportería
        Route::get('/reports/incidents',            [ReportController::class, 'incidents']);
        Route::get('/reports/incidents/export',     [ReportController::class, 'export']);
        Route::get('/reports/incidents/export-pdf', [ReportController::class, 'exportPdf']);

        // Auditoría
        Route::get('/audit', [AuditController::class, 'index']);

        // Carga inicial del histórico MIT/MTOP (Render free tier no da shell,
        // así que mit:import/mit:geocode se disparan por HTTP, solo admin).
        Route::post('/mit/import', [MitImportController::class, 'run']);

        // Usuarios
        Route::get('/users',         [AdminUserController::class, 'index']);
        Route::post('/users',        [AdminUserController::class, 'store']);
        Route::patch('/users/{user}',[AdminUserController::class, 'update']);
        Route::delete('/users/{user}',[AdminUserController::class, 'destroy']);

        // Vehículos
        Route::get('/vehicles',             [AdminVehicleController::class, 'index']);
        Route::post('/vehicles',            [AdminVehicleController::class, 'store']);
        Route::patch('/vehicles/{vehicle}', [AdminVehicleController::class, 'update']);
        Route::delete('/vehicles/{vehicle}',[AdminVehicleController::class, 'destroy']);

        // Rutas predefinidas
        Route::get('/routes',                          [AdminRouteController::class, 'index']);
        Route::post('/routes',                         [AdminRouteController::class, 'store']);
        Route::patch('/routes/{predefinedRoute}',      [AdminRouteController::class, 'update']);
        Route::delete('/routes/{predefinedRoute}',     [AdminRouteController::class, 'destroy']);
    });
});
