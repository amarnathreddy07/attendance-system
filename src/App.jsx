import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useApp } from './state/AppContext.jsx';
import Layout from './components/Layout.jsx';
import Toasts from './components/Toasts.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ClassSetup from './pages/ClassSetup.jsx';
import ClassDetail from './pages/ClassDetail.jsx';
import AttendanceSession from './pages/AttendanceSession.jsx';
import AttendanceReview from './pages/AttendanceReview.jsx';
import AttendanceHistory from './pages/AttendanceHistory.jsx';
import GlobalAttendanceHistory from './pages/GlobalAttendanceHistory.jsx';
import SessionDetail from './pages/SessionDetail.jsx';
import StudentHistory from './pages/StudentHistory.jsx';
import Settings from './pages/Settings.jsx';
import Faq from './pages/Faq.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import { useAuth } from './state/AuthContext.jsx';

function OnlineWatcher() {
  const { setOnline } = useApp();
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [setOnline]);
  return null;
}

function Gate({ children }) {
  const { ready } = useAuth();
  const { teacher } = useApp();
  const location = useLocation();
  if (!ready) return null;
  if (!teacher && location.pathname !== '/login') return <Navigate to="/login" replace />;
  if (teacher && location.pathname === '/login') return <Navigate to="/" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { isAdmin, ready } = useAuth();
  if (!ready) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <OnlineWatcher />
      <Toasts />
      <Routes>
        <Route
          path="/login"
          element={
            <Gate>
              <Login />
            </Gate>
          }
        />
        <Route
          element={
            <Gate>
              <Layout />
            </Gate>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<GlobalAttendanceHistory />} />
          <Route path="/classes/new" element={<ClassSetup />} />
          <Route path="/classes/:id/edit" element={<ClassSetup />} />
          <Route path="/classes/:id" element={<ClassDetail />} />
          <Route path="/classes/:id/attendance" element={<AttendanceSession />} />
          <Route path="/classes/:id/review/:sessionId" element={<AttendanceReview />} />
          <Route path="/classes/:id/history" element={<AttendanceHistory />} />
          <Route path="/classes/:id/history/:sessionId" element={<SessionDetail />} />
          <Route path="/classes/:id/students/:studentId" element={<StudentHistory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/faq" element={<Faq />} />
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <Admin />
              </AdminGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
