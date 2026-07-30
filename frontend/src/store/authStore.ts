import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

// Rehydrate from localStorage
const storedToken = localStorage.getItem('ca_token');
const storedUser = localStorage.getItem('ca_user');

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken ?? null,

  setAuth: (user, token) => {
    localStorage.setItem('ca_token', token);
    localStorage.setItem('ca_user', JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem('ca_token');
    localStorage.removeItem('ca_user');
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!get().token && !!get().user,
}));
