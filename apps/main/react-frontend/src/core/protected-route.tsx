import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { usePermissions } from './permissions-context';

export function ProtectedRoute() {
  const { isAuthenticated, initialized, login } = useAuth();
  const { loaded: permissionsLoaded, isRouteAllowed } = usePermissions();
  const location = useLocation();

  useEffect(() => {
    if (initialized && !isAuthenticated) login();
  }, [initialized, isAuthenticated, login]);

  if (!initialized || !isAuthenticated) return null;
  if (!permissionsLoaded) return <div className="p-lg">Loading…</div>;
  if (!isRouteAllowed(location.pathname)) return <Navigate to="/" replace />;

  return <Outlet />;
}
