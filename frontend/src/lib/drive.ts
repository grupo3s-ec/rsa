/** Extrae el ID de archivo de un link de Google Drive (`.../file/d/{ID}/...`). */
export function driveFileId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  return match ? match[1]! : null;
}

/** Miniatura liviana de una imagen alojada en Drive — para íconos/badges
 * pequeños, en vez del iframe de vista completa (`toEmbedUrl`, pensado para
 * video). `size` es el ancho en px. */
export function driveThumbnailUrl(url: string | null, size = 200): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}
