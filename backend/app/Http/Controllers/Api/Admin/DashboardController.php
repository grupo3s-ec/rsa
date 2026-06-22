<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\PredefinedRoute;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $incidentsBySeverity = Incident::query()
            ->selectRaw('severity, COUNT(*) as total')
            ->groupBy('severity')
            ->pluck('total', 'severity');

        $incidentsByType = Incident::query()
            ->selectRaw('type, COUNT(*) as total')
            ->groupBy('type')
            ->pluck('total', 'type');

        $incidentsByStatus = Incident::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $recentIncidents = Incident::query()
            ->orderByDesc('created_at')
            ->limit(5)
            ->get(['id', 'title', 'type', 'severity', 'status', 'occurred_at', 'created_at']);

        $usersByRole = User::query()
            ->selectRaw('role, COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        return response()->json([
            'incidents' => [
                'total'       => Incident::count(),
                'open'        => Incident::where('status', 'open')->count(),
                'by_severity' => $incidentsBySeverity,
                'by_type'     => $incidentsByType,
                'by_status'   => $incidentsByStatus,
                'recent'      => $recentIncidents,
            ],
            'users' => [
                'total'   => User::count(),
                'by_role' => $usersByRole,
            ],
            'vehicles' => [
                'total'  => Vehicle::count(),
                'active' => Vehicle::where('activo', true)->count(),
            ],
            'routes' => [
                'total'  => PredefinedRoute::count(),
                'active' => PredefinedRoute::where('activo', true)->count(),
            ],
        ]);
    }
}
