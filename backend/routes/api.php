<?php

use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\GeotabController;
use App\Http\Controllers\Api\Admin\PredefinedRouteController as AdminRouteController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\Admin\VehicleController as AdminVehicleController;
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
    Route::get('/incidents',              [IncidentController::class, 'index']);
    Route::get('/incidents/{incident}',   [IncidentController::class, 'show']);
    Route::post('/incidents',             [IncidentController::class, 'store']);
    Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);
    Route::delete('/incidents/{incident}',[IncidentController::class, 'destroy']);

    // Incidentes por ruta
    Route::get('/routes/incidents', RouteIncidentController::class);

    // ── Administración (solo admin) ───────────────────────────────────────────
    Route::middleware('admin')->prefix('admin')->group(function () {

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

        // Dashboard y KPIs
        Route::get('/dashboard', [DashboardController::class, 'index']);

        // Integración Geotab
        Route::get('/geotab/status',  [GeotabController::class, 'status']);
        Route::get('/geotab/devices', [GeotabController::class, 'devices']);
        Route::post('/geotab/sync',   [GeotabController::class, 'sync']);
    });
});
