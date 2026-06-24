<?php

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    /*
     * En producción: FRONTEND_URL=https://rsa-frontend.pages.dev
     * En desarrollo: FRONTEND_URL=http://localhost:3000
     * Para permitir múltiples orígenes separa con coma:
     * FRONTEND_URL=https://rsa-frontend.pages.dev,http://localhost:3000
     */
    'allowed_origins' => array_unique(array_filter(array_merge(
        array_map('trim', explode(',', env('FRONTEND_URL', 'http://localhost:3000'))),
        ['http://localhost:3000', 'http://127.0.0.1:3000']
    ))),

    // Permite cualquier *.workers.dev (incluyendo worker.account.workers.dev)
    'allowed_origins_patterns' => [
        '#^https://[a-z0-9.-]+\.workers\.dev$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
