import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ProtectedRoute } from './core/protected-route';

const Landing = lazy(() => import('./features/landing'));
const Register = lazy(() => import('./features/register'));
const Dashboard = lazy(() => import('./features/dashboard'));
const UserProfile = lazy(() => import('./features/user-profile'));
const Weather = lazy(() => import('./features/weather'));
const Canary = lazy(() => import('./features/canary'));
const AuthCallback = lazy(() => import('./features/auth-callback'));
const AdminLayout = lazy(() => import('./features/admin/admin-layout'));
const PermissionsTab = lazy(
  () => import('./features/admin/permissions-tab'),
);
const UsersTab = lazy(() => import('./features/admin/users-tab'));

export const routes: RouteObject[] = [
  { path: '/', element: <Landing /> },
  { path: '/register', element: <Register /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  { path: '/canary', element: <Canary /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/profile', element: <UserProfile /> },
      { path: '/weather', element: <Weather /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <PermissionsTab /> },
          { path: 'permissions', element: <PermissionsTab /> },
          { path: 'users', element: <UsersTab /> },
        ],
      },
    ],
  },
];
