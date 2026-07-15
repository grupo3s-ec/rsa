<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        $middleware->alias([
            'admin'    => \App\Http\Middleware\AdminMiddleware::class,
            'operator' => \App\Http\Middleware\OperatorMiddleware::class,
        ]);
        // API 100% sin vistas de login — nunca redirigir a un invitado no
        // autenticado. Sin esto, Authenticate::redirectTo() intenta
        // route('login') (inexistente) y lanza un 500 en vez del 401 normal
        // de Sanctum cuando la petición no manda `Accept: application/json`.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
