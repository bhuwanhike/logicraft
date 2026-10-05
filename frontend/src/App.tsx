import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Landing } from './components/landing/Landing';
import { PricingPage } from './components/pricing/PricingPage';
import { LoginPage } from './components/auth/LoginForm';
import { SignupPage } from './components/auth/SignupForm';
import { hasSession } from './services/auth';
import { WorkspaceProvider } from './state/WorkspaceContext';
import { AppShell } from './components/shell/AppShell';
import { DashboardPage } from './components/workspace/DashboardPage';
import { VehiclesPage } from './components/workspace/VehiclesPage';
import { DriversPage } from './components/workspace/DriversPage';
import { ShipmentsPage } from './components/workspace/ShipmentsPage';
import { WarehousesPage } from './components/workspace/WarehousesPage';
import { TrackingPage } from './components/workspace/TrackingPage';
import { AnalyticsPage } from './components/workspace/AnalyticsPage';
import { NotificationsPage } from './components/workspace/NotificationsPage';
import { SettingsPage } from './components/workspace/SettingsPage';
import './components/hero/hero.css';
import './components/auth/auth.css';

/** Re-reads the local session on storage and focus, so cross-tab auth changes show up. */
function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(() => hasSession());

  useEffect(() => {
    const sync = () => setSignedIn(hasSession());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return signedIn;
}

/**
 * Keeps a signed-in user off the login and signup pages. `hasSession` only
 * accepts a session carrying a bearer token, so a legacy token-less entry
 * cannot bounce the visitor away from the form.
 */
export function AuthRoute({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();
  if (signedIn) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Gates the workspace behind a session. Without this the dashboard and every
 * module route rendered for anyone who typed the URL, which is exactly what an
 * authenticated app must not do. The attempted path is kept in location state
 * so sign-in can return the user where they were headed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const signedIn = useSignedIn();

  if (!signedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Landing
            onEnterApp={() => navigate('/dashboard')}
            onSignIn={() => navigate('/login')}
            onSignUp={() => navigate('/signup')}
            onViewPlans={() => navigate('/pricing')}
          />
        }
      />
      <Route
        path="/pricing"
        element={
          <PricingPage
            onEnterApp={() => navigate('/dashboard')}
            onSignIn={() => navigate('/login')}
            onSignUp={() => navigate('/signup')}
          />
        }
      />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <LoginPage />
          </AuthRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthRoute>
            <SignupPage />
          </AuthRoute>
        }
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <WorkspaceProvider>
              <AppShell />
            </WorkspaceProvider>
          </RequireAuth>
        }
      >
        {/* NOTE: no <Route index> here on purpose. An index route inside a
            "/*" splat also matches "/", and it outranks the standalone "/"
            route, so the marketing page silently became the workspace shell.
            The "*" child below is the fallback for genuinely unknown URLs. */}
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="warehouses" element={<WarehousesPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
