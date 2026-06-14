export type UserRole = 'admin' | 'operator' | 'driver';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
}
