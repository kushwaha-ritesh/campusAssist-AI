import { create } from 'zustand';
import type { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

// ── Demo bypass user — used when no real session exists ──────────────────────
const DEMO_USER: User = {
  id: 'bypass-student-001',
  student_id: 'STU001',
  full_name: 'Demo Student',
  email: 'student@demo.edu',
  department: 'Computer Science',
  role: 'student',
  is_active: true,
};
const DEMO_TOKEN = 'bypass';
// ─────────────────────────────────────────────────────────────────────────────

// Rehydrate from localStorage, fall back to demo user
const storedToken = localStorage.getItem('ca_token') ?? DEMO_TOKEN;
const storedUser: User = localStorage.getItem('ca_user')
  ? JSON.parse(localStorage.getItem('ca_user')!)
  : DEMO_USER;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: storedUser,
  token: storedToken,

  setAuth: (user, token) => {
    localStorage.setItem('ca_token', token);
    localStorage.setItem('ca_user', JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: () => {
    localStorage.removeItem('ca_token');
    localStorage.removeItem('ca_user');
    // Reset to demo user instead of null — keeps the app accessible
    set({ user: DEMO_USER, token: DEMO_TOKEN });
  },

  isAuthenticated: () => !!get().token && !!get().user,
}));
