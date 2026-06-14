<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // Idempotente: solo crea el admin si no existe ningún usuario administrador.
        User::firstOrCreate(
            ['email' => 'admin@rsa.ec'],
            [
                'name'     => 'Administrador',
                'password' => 'Admin2026!',
                'role'     => 'admin',
            ]
        );
    }
}
