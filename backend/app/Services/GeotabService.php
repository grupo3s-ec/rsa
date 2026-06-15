<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class GeotabService
{
    private string $server;
    private string $userName;
    private string $password;
    private string $database;
    private ?array $credentials = null;

    public function __construct()
    {
        $this->server   = config('services.geotab.server', 'my.geotab.com');
        $this->userName = config('services.geotab.username', '');
        $this->password = config('services.geotab.password', '');
        $this->database = config('services.geotab.database', '');
    }

    public function isConfigured(): bool
    {
        return $this->userName !== '' && $this->password !== '' && $this->database !== '';
    }

    /** Envía una llamada JSON-RPC a la API de MyGeotab. */
    private function rpc(string $method, array $params): mixed
    {
        $response = Http::acceptJson()
            ->asJson()
            ->post("https://{$this->server}/apiv1/", [
                'method' => $method,
                'params' => $params,
            ]);

        $json = $response->json();

        if (isset($json['error'])) {
            throw new RuntimeException($json['error']['message'] ?? 'Error en la API de Geotab');
        }

        return $json['result'] ?? null;
    }

    /** Autentica y almacena la sesión. Redirige el servidor si Geotab lo indica. */
    public function authenticate(): void
    {
        $result = $this->rpc('Authenticate', [
            'userName' => $this->userName,
            'password' => $this->password,
            'database' => $this->database,
        ]);

        if (isset($result['path']) && $result['path'] !== 'ThisServer') {
            $this->server = $result['path'];
        }

        $this->credentials = $result['credentials'];
    }

    /** Llama a la API con credenciales; reintenta una vez si la sesión expiró. */
    private function call(string $method, array $params): mixed
    {
        if ($this->credentials === null) {
            $this->authenticate();
        }

        $payload = array_merge($params, ['credentials' => $this->credentials]);

        try {
            return $this->rpc($method, $payload);
        } catch (RuntimeException $e) {
            $msg = strtolower($e->getMessage());
            if (str_contains($msg, 'sessionexpired') || str_contains($msg, 'authentication')) {
                $this->credentials = null;
                $this->authenticate();
                return $this->rpc($method, array_merge($params, ['credentials' => $this->credentials]));
            }
            throw $e;
        }
    }

    /** Devuelve todos los dispositivos (vehículos) registrados en la cuenta. */
    public function getDevices(): array
    {
        return (array) $this->call('Get', ['typeName' => 'Device']);
    }

    /** Devuelve todas las reglas definidas en la cuenta. */
    public function getRules(): array
    {
        return (array) $this->call('Get', ['typeName' => 'Rule']);
    }

    /**
     * Devuelve los ExceptionEvents en el rango de fechas indicado.
     *
     * @param string      $fromDate ISO 8601 UTC, ej: "2025-01-01T00:00:00.000Z"
     * @param string      $toDate   ISO 8601 UTC
     * @param string|null $deviceId Filtro opcional por dispositivo Geotab
     */
    public function getExceptionEvents(string $fromDate, string $toDate, ?string $deviceId = null): array
    {
        $search = ['fromDate' => $fromDate, 'toDate' => $toDate];

        if ($deviceId !== null) {
            $search['deviceSearch'] = ['id' => $deviceId];
        }

        return (array) $this->call('Get', [
            'typeName' => 'ExceptionEvent',
            'search'   => $search,
        ]);
    }
}
