<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales son incorrectas.'],
            ]);
        }

        // Revoca tokens anteriores del mismo dispositivo para evitar acumulación.
        $user->tokens()->where('name', 'web')->delete();

        $expiresAt = $request->boolean('remember')
            ? now()->addDays(30)
            : now()->addHours(6);

        $token = $user->createToken('web', ['*'], $expiresAt)->plainTextToken;

        Audit::log('login', 'user', $user->id, $user->email);

        return response()->json([
            'user'       => $user,
            'token'      => $token,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Audit::log('logout', 'user', $request->user()->id, $request->user()->email);

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }
}
