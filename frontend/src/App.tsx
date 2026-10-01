import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
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

/**
 * Keeps a signed-in user off the login and signup pages. There is no session
 * server behind this yet, so the check is local — but the redirect-on-submit in
 * the forms is the part that actually matters, and that is unconditional.
 */
function AuthRoute({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(() => hasSession());

  useEffect(() => {
    // A tab that signs in elsewhere should not still be showing the form.
    const sync = () => setSignedIn(hasSession());
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (signedIn) return <Navigate to="/dashboard" replace />;
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
          <WorkspaceProvider>
            <AppShell />
          </WorkspaceProvider>
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
