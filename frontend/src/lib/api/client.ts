import { getToken } from '@/lib/auth/token';

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

interface ApiRequestOptions extends RequestInit {
  query?: QueryParams;
  /** Reintenta también en POST/PATCH/DELETE — solo para llamadas que en la
   * práctica son de solo lectura (ej. una consulta con payload demasiado
   * largo para ir en querystring). GET siempre reintenta sin necesidad de
   * esto; no usar en un POST que cree/modifique algo. */
  idempotent?: boolean;
}

function getApiBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL environment variable.');
  return apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

function buildUrl(path: string, query?: QueryParams): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${getApiBaseUrl()}${normalizedPath}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

/** Reintentables: fallo de red (fetch rechaza) o 502/503/504 — el patrón del
 * cold-start de Render free tier (hasta ~1 min despertando), no errores de
 * negocio/validación (4xx) ni 500 real. */
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [800, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const { query, headers, method, idempotent, ...requestOptions } = options;
  const isRetryable = !method || method === 'GET' || idempotent === true;

  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const url = buildUrl(path, query);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        ...requestOptions,
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...authHeader,
          ...headers,
        },
      });
    } catch (err) {
      lastError = err;
      if (isRetryable && attempt < RETRY_DELAYS_MS.length) { await sleep(RETRY_DELAYS_MS[attempt]); continue; }
      throw err;
    }

    if (!response.ok) {
      if (isRetryable && RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      const body = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(body.message ?? `API error ${response.status}`);
    }

    return response.json() as Promise<TResponse>;
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed');
}

async function requestForm<TResponse>(path: string, formData: FormData, timeoutMs = 60_000): Promise<TResponse> {
  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(timeoutMs),
    // Sin Content-Type: el browser lo pone con el multipart boundary correcto
    headers: { Accept: 'application/json', ...authHeader },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `API error ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export const apiClient = {
  get: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse> =>
    request<TResponse>(path, { ...options, method: 'GET' }),

  post: <TResponse, TBody extends object>(
    path: string,
    body: TBody,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<TResponse> =>
    request<TResponse>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),

  patch: <TResponse, TBody extends object>(
    path: string,
    body: TBody,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ): Promise<TResponse> =>
    request<TResponse>(path, { ...options, method: 'PATCH', body: JSON.stringify(body) }),

  delete: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<TResponse> =>
    request<TResponse>(path, { ...options, method: 'DELETE' }),

  form: <TResponse>(path: string, formData: FormData, timeoutMs?: number): Promise<TResponse> =>
    requestForm<TResponse>(path, formData, timeoutMs),
};

export type { QueryParams };
