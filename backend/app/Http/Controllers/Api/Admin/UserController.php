<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'created_at']);

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role'     => ['required', Rule::in(['admin', 'operator', 'driver'])],
        ]);

        $user = User::query()->create($data);

        Audit::log('user.create', 'user', $user->id, $user->email);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'created_at']), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['sometimes', 'string', 'max:255'],
            'email'    => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'role'     => ['sometimes', Rule::in(['admin', 'operator', 'driver'])],
        ]);

        // Solo actualizar contraseña si se envió y no está vacía
        if (isset($data['password']) && $data['password'] === null) {
            unset($data['password']);
        }

        if (
            isset($data['role'])
            && $data['role'] !== 'admin'
            && $user->role === 'admin'
            && User::query()->where('role', 'admin')->count() <= 1
        ) {
            abort(422, 'No puedes quitarle el rol admin al último administrador del sistema.');
        }

        $roleChanged = isset($data['role']) && $data['role'] !== $user->role;
        $previousRole = $user->role;

        $user->update($data);

        $label = $user->email;
        if ($roleChanged) {
            $label .= sprintf(' (rol: %s → %s)', $previousRole, $data['role']);
        }

        Audit::log('user.update', 'user', $user->id, $label);

        return response()->json($user->fresh()->only(['id', 'name', 'email', 'role', 'created_at']));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            abort(422, 'No puedes eliminar tu propia cuenta.');
        }

        if ($user->role === 'admin' && User::query()->where('role', 'admin')->count() <= 1) {
            abort(422, 'No puedes eliminar al último administrador del sistema.');
        }

        Audit::log('user.delete', 'user', $user->id, $user->email);

        $user->tokens()->delete();
        $user->delete();

        return response()->json(null, 204);
    }
}
