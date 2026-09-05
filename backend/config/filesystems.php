<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        // Cloudflare R2 — compatible con S3 API.
        // El bucket debe tener acceso público habilitado (subdominio r2.dev o dominio propio).
        // Supabase Storage vía su endpoint S3-compatible (sin costo, sin tarjeta
        // requerida a diferencia de R2/Firebase — ver memoria del proyecto).
        // Credenciales: Supabase Dashboard > Storage > S3 Connection.
        'supabase' => [
            'driver'                  => 's3',
            'key'                     => env('SUPABASE_S3_ACCESS_KEY_ID'),
            'secret'                  => env('SUPABASE_S3_SECRET_ACCESS_KEY'),
            'region'                  => env('SUPABASE_S3_REGION'),
            'bucket'                  => env('SUPABASE_S3_BUCKET', 'rsa-evidencias'),
            'endpoint'                => env('SUPABASE_S3_ENDPOINT'), // https://<project_ref>.storage.supabase.co/storage/v1/s3
            'url'                     => env('SUPABASE_STORAGE_PUBLIC_URL'), // https://<project_ref>.supabase.co/storage/v1/object/public/<bucket>
            'use_path_style_endpoint' => true,
            'throw'                   => true,
            'report'                  => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
