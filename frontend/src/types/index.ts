// ─── Shared Types ──────────────────────────────────────────────────────────

export type Role = 'student' | 'admin';

export interface User {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  department?: string;
  role: Role;
  is_active: boolean;
  created_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── Requests ──────────────────────────────────────────────────────────────

export type RequestCategory = 'academic' | 'financial' | 'technical' | 'administrative' | 'other';
export type RequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type RequestPriority = 'low' | 'medium' | 'high';

export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  student_id: string;
  student_name: string;
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

// ─── Appointments ──────────────────────────────────────────────────────────

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Appointment {
  id: string;
  office: string;
  purpose: string;
  date: string;
  time_slot: string;
  notes?: string;
  student_id: string;
  student_name: string;
  status: AppointmentStatus;
  created_at: string;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export type NotifType = 'info' | 'warning' | 'success' | 'error';

export interface Notification {
  id: string;
  student_id: string;
  title: string;
  message: string;
  type: NotifType;
  is_read: boolean;
  created_at: string;
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  session_id: string;
  student_id: string;
  messages: ChatMessage[];
}

// ─── Office / Campus Info ──────────────────────────────────────────────────

export interface Office {
  id: string;
  name: string;
  block: string;
  room: string;
  phone: string;
  email: string;
  hours: string;
  services: string[];
}

export interface DocumentCategory {
  category: string;
  documents: string[];
}

// ─── Admin Stats ───────────────────────────────────────────────────────────

export interface AdminStats {
  total_students: number;
  open_requests: number;
  in_progress_requests: number;
  resolved_requests: number;
  total_appointments: number;
  pending_appointments: number;
}
