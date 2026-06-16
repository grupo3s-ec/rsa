import { apiClient } from '@/lib/api/client';
import type { AuthUser, LoginResponse } from '@/types/auth';

export const authService = {
  login: (email: string, password: string, remember: boolean) =>
    apiClient.post<LoginResponse, { email: string; password: string; remember: boolean }>(
      '/auth/login',
      { email, password, remember },
    ),

  logout: () =>
    apiClient.post<{ message: string }, Record<string, never>>('/auth/logout', {}),

  me: () =>
    apiClient.get<AuthUser>('/auth/me'),
};
