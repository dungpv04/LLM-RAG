import { api } from './api';
import type { AuthResponse, MeResponse } from '../types';

export const authService = {
  login(email: string, password: string): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', { email, password });
  },

  signup(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/signup', {
      email,
      password,
      full_name: fullName,
    });
  },

  me(): Promise<MeResponse> {
    return api.get<MeResponse>('/auth/me');
  },

  logout(): Promise<{ message: string }> {
    return api.post<{ message: string }>('/auth/logout', {});
  },
};
