import api from './client';
import type { User, HelpRequest, Appointment, Notification, Office, DocumentCategory, AdminStats, ChatMessage } from '../types';

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginPayload { username: string; password: string; }
export interface RegisterPayload {
  student_id: string; full_name: string; email: string;
  department?: string; password: string; role?: string; admin_code?: string;
}

export const authApi = {
  login: async (payload: LoginPayload) => {
    const form = new URLSearchParams();
    form.append('username', payload.username);
    form.append('password', payload.password);
    const res = await api.post('/auth/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return res.data as { access_token: string; token_type: string; user: User };
  },
  register: (payload: RegisterPayload) => api.post('/auth/register', payload).then(r => r.data as User),
  me: () => api.get('/auth/me').then(r => r.data as User),
};

// ─── Requests ─────────────────────────────────────────────────────────────

export const requestsApi = {
  list: (status?: string) => api.get('/requests', { params: status ? { status } : {} }).then(r => r.data as HelpRequest[]),
  get: (id: string) => api.get(`/requests/${id}`).then(r => r.data as HelpRequest),
  create: (payload: Partial<HelpRequest>) => api.post('/requests', payload).then(r => r.data as HelpRequest),
  update: (id: string, payload: { status?: string; admin_note?: string }) => api.patch(`/requests/${id}`, payload).then(r => r.data as HelpRequest),
  remove: (id: string) => api.delete(`/requests/${id}`),
};

// ─── Appointments ──────────────────────────────────────────────────────────

export const appointmentsApi = {
  list: () => api.get('/appointments').then(r => r.data as Appointment[]),
  create: (payload: Partial<Appointment>) => api.post('/appointments', payload).then(r => r.data as Appointment),
  updateStatus: (id: string, status: string) => api.patch(`/appointments/${id}/status`, null, { params: { status } }).then(r => r.data as Appointment),
  cancel: (id: string) => api.delete(`/appointments/${id}`),
};

// ─── Notifications ─────────────────────────────────────────────────────────

export const notificationsApi = {
  list: () => api.get('/notifications').then(r => r.data as Notification[]),
  create: (payload: Partial<Notification>) => api.post('/notifications', payload).then(r => r.data as Notification),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ─── AI Chat ───────────────────────────────────────────────────────────────

export const aiApi = {
  chat: (message: string, session_id?: string) =>
    api.post('/ai/chat', { message, session_id }).then(r => r.data as { session_id: string; reply: string; history: ChatMessage[] }),
  sessions: () => api.get('/ai/sessions').then(r => r.data),
};

/**
 * SSE streaming chat. Opens a fetch stream to /api/ai/chat/stream and calls:
 *   onToken(text)      — for each arriving token
 *   onDone(sessionId)  — when [DONE]:<session_id> is received
 *   onError(err)       — on network or parse errors
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function streamChat(
  message: string,
  sessionId: string | undefined,
  onToken: (text: string) => void,
  onDone: (sessionId: string) => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();
  const base = import.meta.env.VITE_API_URL ?? '';
  const token = localStorage.getItem('ca_token');

  const body = JSON.stringify({ message, session_id: sessionId ?? null });

  (async () => {
    try {
      const res = await fetch(`${base}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';           // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);      // strip "data: "

          if (payload.startsWith('[DONE]:')) {
            onDone(payload.slice(7));         // extract session_id after [DONE]:
            return;
          }

          // Unescape \n back to real newlines
          onToken(payload.replace(/\\n/g, '\n'));
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') onError(err);
    }
  })();

  return controller;
}

// ─── Campus Info ───────────────────────────────────────────────────────────

export const campusApi = {
  offices: () => api.get('/offices').then(r => r.data as Office[]),
  documents: () => api.get('/documents').then(r => r.data as DocumentCategory[]),
};

// ─── Admin ─────────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => api.get('/admin/stats').then(r => r.data as AdminStats),
  students: () => api.get('/admin/students').then(r => r.data as User[]),
  toggleActive: (student_id: string) => api.patch(`/admin/students/${student_id}/toggle-active`).then(r => r.data),
};
