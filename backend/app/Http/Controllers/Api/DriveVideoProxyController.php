<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DriveVideoProxyController extends Controller
{
    /** Tamaño de cada lectura del stream de Drive, en bytes. */
    private const CHUNK_SIZE = 65536;

    /**
     * Transmite un video de Google Drive a través de nuestro propio backend.
     *
     * El link directo de descarga de Drive (uc?export=download) funciona bien
     * server-side, pero Drive le agrega `Content-Security-Policy: sandbox` a
     * esa respuesta — el navegador respeta ese header y se niega a reproducir
     * el archivo en un <video> embebido en otra página. Al pasar por este
     * proxy, el navegador recibe la respuesta desde nuestro propio dominio,
     * sin ese header, así que sí puede reproducirlo (ver DriveVideoPlayer.tsx,
     * que lo consume como blob autenticado, mismo patrón que la descarga del
     * PDF de riesgos).
     *
     * Transmite en streaming (no vuelca el archivo completo a un string en
     * memoria primero) — un video de campo puede pesar decenas de MB, y este
     * proxy corre en un Render Nano (memoria muy limitada); bufferear el
     * archivo completo por request podía tumbar el contenedor entero con solo
     * 2-3 reproducciones simultáneas.
     */
    public function stream(Request $request, string $fileId): StreamedResponse
    {
        // \z en vez de $ — $ en PCRE acepta un salto de línea final.
        abort_unless((bool) preg_match('/^[\w-]{10,100}\z/', $fileId), 404);

        $upstream = Http::withOptions(['stream' => true])
            ->connectTimeout(10)
            ->timeout(60)
            ->get("https://drive.google.com/uc?export=download&id={$fileId}");

        abort_unless($upstream->successful(), 502, 'No se pudo obtener el video de Drive.');

        $contentType = $upstream->header('Content-Type') ?: 'application/octet-stream';

        // Un archivo grande sin escanear por Drive, o un fileId sin permisos,
        // devuelve una página HTML de aviso con status 200 — sin esta
        // validación se serviría esa página como si fuera video/mp4 y el
        // <video> fallaría en el navegador sin ninguna pista de la causa real.
        abort_unless(str_starts_with($contentType, 'video/'), 502, 'El archivo de Drive no es un video reproducible.');

        $body = $upstream->toPsrResponse()->getBody();
        $contentLength = $upstream->header('Content-Length');

        $headers = [
            'Content-Type' => $contentType,
            // No hay endpoint de "listar videos válidos" que lo respalde —
            // ver nota de seguridad en el PR/checkpoint: cualquier usuario
            // autenticado puede hacer que el backend traiga cualquier archivo
            // público de Drive. Interno, autenticado, y de bajo riesgo, pero
            // no verificado contra los video_url conocidos.
            'Cache-Control' => 'private, max-age=3600',
        ];
        if ($contentLength) {
            $headers['Content-Length'] = $contentLength;
        }

        return response()->stream(function () use ($body) {
            while (! $body->eof()) {
                echo $body->read(self::CHUNK_SIZE);
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }
        }, 200, $headers);
    }
}
