import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './core/auth-context';
import { PermissionsProvider } from './core/permissions-context';
import { ErrorBoundary } from './core/error-boundary';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PermissionsProvider>
          <Suspense fallback={<div className="p-lg">Loading…</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </PermissionsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
