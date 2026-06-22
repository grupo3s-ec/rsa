<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OperatorMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!in_array($request->user()?->role, ['admin', 'operator'])) {
            abort(403, 'Acceso restringido.');
        }

        return $next($request);
    }
}
