import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Approvals } from './pages/Approvals';
import { Employees } from './pages/Employees';
import { Reports } from './pages/Reports';
import { DetailedReports } from './pages/DetailedReports';
import { Settings } from './pages/Settings';
import { Companies } from './pages/Companies';
import { Projects } from './pages/Projects';
import { Workspaces } from './pages/Workspaces';
import { Policies } from './pages/Policies';
import { DevMode } from './pages/DevMode';
import { Schedules } from './pages/Schedules';
import { MyShifts } from './pages/MyShifts';
import { DevTerminalPanel } from './pages/DevTerminalPanel';
import { ShiftPushRegistrar } from './components/ShiftPushRegistrar';
import { Loader2 } from 'lucide-react';
import { api } from './services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const userStr = localStorage.getItem('tyo_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const DEV_PANEL_ROUTE = (import.meta.env.VITE_DEV_PANEL_PATH as string | undefined) || '/__ops_terminal';

const App: React.FC = () => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const user = await api.me();
        if (user) {
          localStorage.setItem('tyo_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('tyo_user');
        }
      } catch {
        localStorage.removeItem('tyo_user');
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, []);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <HashRouter>
      <ShiftPushRegistrar />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/companies"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <Companies />
            </ProtectedRoute>
          }
        />

        <Route
          path="/approvals"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Approvals />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Projects />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspaces"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Workspaces />
            </ProtectedRoute>
          }
        />

        <Route
          path="/policies"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Policies />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/schedules"
          element={
            <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
              <Schedules />
            </ProtectedRoute>
          }
        />

        <Route
          path="/detailed-reports"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <DetailedReports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-shifts"
          element={
            <ProtectedRoute allowedRoles={['EMPLOYEE']}>
              <MyShifts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route path="/dev-mode" element={<DevMode />} />
        <Route path={DEV_PANEL_ROUTE} element={<DevTerminalPanel />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </HashRouter>
  );
};

export default App;

