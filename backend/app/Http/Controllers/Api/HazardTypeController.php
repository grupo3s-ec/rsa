<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HazardType;
use Illuminate\Http\JsonResponse;

class HazardTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $hazardTypes = HazardType::query()
            ->orderBy('name')
            ->get(['id', 'condition', 'name', 'risks', 'severity']);

        return response()->json(['data' => $hazardTypes]);
    }
}
