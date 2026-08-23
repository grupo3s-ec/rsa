'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { EmbedUrl } from '@/lib/incidents/format';
import { driveVideoStreamUrl } from '@/lib/api/media';
import { getToken } from '@/lib/auth/token';

interface DriveVideoPlayerProps {
  embed: EmbedUrl;
  title: string;
  className?: string;
}

/**
 * Video de Google Drive con <video muted> nativo — arranca en mute y el
 * usuario lo puede activar con los controles del reproductor.
 *
 * El iframe de Drive (`/preview`) no tiene ningún parámetro de mute, y el
 * link directo de descarga de Drive falla en el navegador: Drive le agrega
 * `Content-Security-Policy: sandbox` a esa respuesta, y el navegador respeta
 * ese header negándose a reproducirlo embebido en otra página (confirmado
 * con un video real de producción). Por eso el video se trae como blob
 * autenticado a través de nuestro propio backend (mismo patrón que la
 * descarga del PDF de riesgos) — desde nuestro dominio, sin ese header, el
 * navegador sí lo reproduce.
 *
 * Si el proxy falla por cualquier motivo, cae de vuelta al iframe de Drive
 * de siempre (sin mute garantizado, pero funcionando) en vez de dejar un
 * reproductor roto.
 *
 * IMPORTANTE: al usarlo donde el video puede cambiar (ej. al seleccionar
 * otro km/incidente), pasar `key={embed.fileId}` — así React monta una
 * instancia nueva por video en vez de reusar el estado (blob/error) del
 * video anterior.
 */
export function DriveVideoPlayer({ embed, title, className }: DriveVideoPlayerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (embed.kind !== 'drive' || !embed.fileId) return;

    let active = true;
    let objectUrl: string | null = null;
    const token = getToken();

    // Sin forzar `cache: 'no-store'` — el backend manda Cache-Control con
    // 1h de validez (ver DriveVideoProxyController) y queremos que el
    // navegador lo respete: reabrir el mismo video no debería re-descargar
    // varios MB desde Drive vía nuestro backend cada vez.
    fetch(driveVideoStreamUrl(embed.fileId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [embed.kind, embed.fileId]);

  if (embed.kind !== 'drive' || !embed.url) return null;

  if (failed) {
    return (
      <iframe
        src={embed.url}
        title={title}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className={className}
      />
    );
  }

  if (!blobUrl) {
    return <Skeleton className={className} />;
  }

  return (
    <video
      src={blobUrl}
      controls
      muted
      playsInline
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
