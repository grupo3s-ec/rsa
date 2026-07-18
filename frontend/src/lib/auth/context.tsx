'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '@/services/auth.service';
import { clearToken, getCachedUser, getToken, setCachedUser, setToken } from '@/lib/auth/token';
import type { AuthUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** true mientras se intenta despertar el backend de Render (free tier
   * duerme tras inactividad) — cualquier pantalla puede mostrar un aviso
   * mientras esto sea true, en vez de una carga sin explicación. */
  warming: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(true);

  // Despierta el backend de Render apenas se carga la app (no solo en
  // login) — antes solo la página de login disparaba esto, así que entrar
  // directo a /mapa o /admin con una sesión ya guardada nunca lo activaba y
  // la primera petición real se quedaba esperando sin ningún aviso.
  useEffect(() => {
    let cancelled = false;

    async function warmup() {
      for (let i = 0; i < 6; i++) {
        if (cancelled) return;
        try {
          await fetch(`${API_BASE}/ping`, { signal: AbortSignal.timeout(10_000) });
          break;
        } catch {
          if (i < 5 && !cancelled) await new Promise(r => setTimeout(r, 8_000));
        }
      }
      if (!cancelled) setWarming(false);
    }

    void warmup();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    // Restaurar sesión desde caché local → la UI aparece de inmediato sin flash de logout
    const cached = getCachedUser<AuthUser>();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    let cancelled = false;

    authService
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setCachedUser(u);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Solo cerrar sesión si el servidor rechazó el token (ej. 401 → Error normal).
        // Un TypeError indica falla de red (Render durmiendo) → conservar la sesión.
        if (!(err instanceof TypeError)) {
          clearToken();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled && !cached) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const { user, token, expires_at } = await authService.login(email, password, remember);
    setToken(token, expires_at);
    setCachedUser(user);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } finally {
      clearToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, warming, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
