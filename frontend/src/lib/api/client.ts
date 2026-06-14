import { getToken } from '@/lib/auth/token';

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

interface ApiRequestOptions extends RequestInit {
  query?: QueryParams;
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

async function request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
  const { query, headers, ...requestOptions } = options;

  const token = getToken();
  const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(buildUrl(path, query), {
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader,
      ...headers,
    },
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
};

export type { QueryParams };
