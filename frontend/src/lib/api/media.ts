/** URL de nuestro proxy de video de Drive — evita el bloqueo por
 * `Content-Security-Policy: sandbox` que Drive agrega al link directo de
 * descarga (ver DriveVideoProxyController en el backend). Se consume como
 * blob autenticado desde DriveVideoPlayer, mismo patrón que la descarga del
 * PDF de riesgos (ver `downloadWithAuth` en RiskEvaluationPanel.tsx). */
export function driveVideoStreamUrl(fileId: string): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL environment variable.');
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  return `${base}/media/drive-video/${encodeURIComponent(fileId)}`;
}
