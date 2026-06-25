const TOKEN_KEY  = 'rsa_token';
const EXPIRY_KEY = 'rsa_token_expiry';
const USER_KEY   = 'rsa_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (expiry && Date.now() > parseInt(expiry, 10)) {
    clearToken();
    return null;
  }

  return token;
}

export function setToken(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(new Date(expiresAt).getTime()));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCachedUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setCachedUser<T>(user: T): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
