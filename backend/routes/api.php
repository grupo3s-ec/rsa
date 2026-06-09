<?php

use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\RouteIncidentController;
use Illuminate\Support\Facades\Route;

Route::get('/incidents', [IncidentController::class, 'index']);
Route::get('/incidents/{incident}', [IncidentController::class, 'show']);
Route::post('/incidents', [IncidentController::class, 'store']);

Route::get('/routes/incidents', RouteIncidentController::class);