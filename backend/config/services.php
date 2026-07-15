<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'geotab' => [
        'server'   => env('GEOTAB_SERVER', 'my.geotab.com'),
        'username' => env('GEOTAB_USERNAME', ''),
        'password' => env('GEOTAB_PASSWORD', ''),
        'database' => env('GEOTAB_DATABASE', ''),
    ],

    'via_poll' => [
        // Token compartido para que un cron externo (ej. cron-job.org) dispare
        // POST /vias/poll sin necesitar una sesión de usuario autenticada.
        'token' => env('VIA_POLL_TOKEN', ''),
    ],

    'google_maps' => [
        // Clave server-side (sin restricción por referrer HTTP) para llamar a la
        // Geocoding API desde el backend. Es distinta de la clave pública del
        // frontend (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY), que sí está restringida
        // por referrer y por eso no sirve para llamadas servidor-a-servidor.
        'server_key' => env('GOOGLE_MAPS_SERVER_KEY', ''),
    ],

];
