import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/student/DashboardPage';
import AskAIPage from './pages/student/AskAIPage';
import FindOfficePage from './pages/student/FindOfficePage';
import RequiredDocsPage from './pages/student/RequiredDocsPage';
import RaiseRequestPage from './pages/student/RaiseRequestPage';
import TrackRequestPage from './pages/student/TrackRequestPage';
import BookAppointmentPage from './pages/student/BookAppointmentPage';
import NotificationsPage from './pages/student/NotificationsPage';

// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminRequestsPage from './pages/admin/AdminRequestsPage';
import AdminStudentsPage from './pages/admin/AdminStudentsPage';
import AdminAppointmentsPage from './pages/admin/AdminAppointmentsPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';

// Layout
import AppLayout from './components/layout/AppLayout';

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, token } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          token ? <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <LoginPage />
        } />
        <Route path="/register" element={
          token ? <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <RegisterPage />
        } />

        {/* Student */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="ask-ai" element={<AskAIPage />} />
          <Route path="find-office" element={<FindOfficePage />} />
          <Route path="documents" element={<RequiredDocsPage />} />
          <Route path="raise-request" element={<RaiseRequestPage />} />
          <Route path="track-request" element={<TrackRequestPage />} />
          <Route path="book-appointment" element={<BookAppointmentPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AppLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="students" element={<AdminStudentsPage />} />
          <Route path="appointments" element={<AdminAppointmentsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
