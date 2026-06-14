import { apiClient } from '@/lib/api/client';
import type { AuthUser, LoginResponse } from '@/types/auth';

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse, { email: string; password: string }>(
      '/api/auth/login',
      { email, password },
    ),

  logout: () =>
    apiClient.post<{ message: string }, Record<string, never>>('/api/auth/logout', {}),

  me: () =>
    apiClient.get<AuthUser>('/api/auth/me'),
};
