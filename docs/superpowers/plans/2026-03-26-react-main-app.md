# Main App React Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/main/frontend` (Angular) with a React app at `apps/main/react-frontend/`, using `@aspect/react-ui` for shared components and `@aspect/design-system` for styling.

**Architecture:** Vite + React 19 + React Router v7. Auth via Keycloak (same `keycloak-js` library). API layer is a typed fetch wrapper (no code generation). State management via React hooks + context — no external library. Forms use controlled components with inline validation. All CSS comes from the existing design system.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, React Router 7, keycloak-js, @aspect/react-ui, @aspect/design-system

**Spec:** `docs/plans/react-ui-migration.md` (ADR, Phase 4)

---

## File Structure

```
apps/main/react-frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env                              # Dev environment
├── .env.production                   # Prod environment
├── public/
│   └── silent-check-sso.html         # Keycloak SSO iframe (copy from Angular)
├── src/
│   ├── main.tsx                      # React bootstrap
│   ├── env.d.ts                      # Vite env type declarations
│   ├── styles/
│   │   └── styles.css                # Design system + font imports
│   ├── core/
│   │   ├── auth-context.tsx          # Keycloak init, AuthProvider, useAuth
│   │   ├── auth-context.spec.tsx     # Auth tests (mocked Keycloak)
│   │   ├── permissions-context.tsx   # PermissionsProvider, usePermissions
│   │   ├── api.ts                    # Typed fetch wrapper with auth headers
│   │   ├── api.types.ts             # Shared API types
│   │   ├── error-boundary.tsx        # Global React error boundary
│   │   └── protected-route.tsx       # Auth + permissions route guard
│   ├── app.tsx                       # Root component with providers
│   ├── routes.tsx                    # Route definitions with lazy loading
│   └── features/
│       ├── landing.tsx
│       ├── register.tsx
│       ├── dashboard.tsx
│       ├── user-profile.tsx
│       ├── weather.tsx
│       ├── canary.tsx
│       ├── auth-callback.tsx
│       └── admin/
│           ├── admin-layout.tsx      # Tab nav + Outlet
│           ├── permissions-tab.tsx   # Data table + dialog CRUD
│           ├── permission-form.tsx   # 4-field form
│           ├── users-tab.tsx         # User table + search
│           ├── roles-management.tsx  # Role list + create dialog
│           └── user-roles-dialog.tsx # Checkbox role assignment
```

---

### Task 1: Scaffold React App

**Files:**
- Create: `apps/main/react-frontend/package.json`
- Create: `apps/main/react-frontend/vite.config.ts`
- Create: `apps/main/react-frontend/tsconfig.json`
- Create: `apps/main/react-frontend/index.html`
- Create: `apps/main/react-frontend/.env`
- Create: `apps/main/react-frontend/.env.production`
- Create: `apps/main/react-frontend/src/env.d.ts`
- Create: `apps/main/react-frontend/src/main.tsx`
- Create: `apps/main/react-frontend/src/styles/styles.css`
- Create: `apps/main/react-frontend/public/silent-check-sso.html`
- Modify: root `package.json` (add workspace)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@aspect/main-react-frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@aspect/design-system": "*",
    "@aspect/react-ui": "*",
    "@fontsource-variable/inter": "^5.1.1",
    "@fontsource-variable/jetbrains-mono": "^5.1.4",
    "keycloak-js": "^26.2.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.4",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "^5.9.2",
    "vite": "^6.3.5",
    "vitest": "^4.0.8"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  resolve: {
    alias: {
      '@aspect/design-system': path.resolve(
        __dirname,
        '../../packages/design-system/index.css',
      ),
    },
    preserveSymlinks: true,
  },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "paths": {
      "@aspect/react-ui": ["../../packages/react-ui/src/index.ts"],
      "@aspect/design-system": ["../../packages/design-system/index.css"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Frontend</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create environment files**

.env:
```
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=boilerplate
VITE_KEYCLOAK_CLIENT_ID=frontend-app
```

.env.production:
```
VITE_API_BASE_URL=https://api.example.com
VITE_KEYCLOAK_URL=https://auth.example.com
VITE_KEYCLOAK_REALM=boilerplate
VITE_KEYCLOAK_CLIENT_ID=frontend-app
```

src/env.d.ts:
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_KEYCLOAK_URL: string;
  readonly VITE_KEYCLOAK_REALM: string;
  readonly VITE_KEYCLOAK_CLIENT_ID: string;
}
```

- [ ] **Step 6: Create main.tsx (placeholder — providers added in Task 2-4)**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>App loading…</div>
  </StrictMode>,
);
```

- [ ] **Step 7: Create styles.css**

```css
@layer vendor, reset, tokens, utilities, components;

@import '@aspect/design-system';
```

- [ ] **Step 8: Copy silent-check-sso.html**

Copy from `apps/main/frontend/public/silent-check-sso.html` to `apps/main/react-frontend/public/silent-check-sso.html`. Content:

```html
<!doctype html>
<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>
```

- [ ] **Step 9: Add workspace to root package.json**

Add `"apps/main/react-frontend"` to the workspaces array.

- [ ] **Step 10: Install and verify**

Run: `npm install` from monorepo root
Run: `cd apps/main/react-frontend && npx vite --host 0.0.0.0` (verify dev server starts)

- [ ] **Step 11: Commit**

```bash
git add apps/main/react-frontend/ package.json package-lock.json
git commit -m "feat(main): scaffold React frontend with Vite

Vite dev server on port 4200, API proxy to :8000, design system CSS,
Keycloak SSO iframe, environment config."
```

---

### Task 2: Auth Infrastructure

**Files:**
- Create: `apps/main/react-frontend/src/core/auth-context.tsx`
- Create: `apps/main/react-frontend/src/core/api.ts`
- Create: `apps/main/react-frontend/src/core/api.types.ts`

- [ ] **Step 1: Create api.types.ts**

```typescript
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface PermissionMapping {
  id: number;
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string | null;
  created_at: string;
  updated_at: string;
}

export interface PermissionBody {
  role: string;
  route_pattern: string;
  method: string;
  frontend_route?: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  roles: { id: string; name: string; description: string }[];
}

export interface KeycloakRole {
  id: string;
  name: string;
  description: string;
}

export interface Weather {
  city: string;
  country: string;
  temperature_celsius: number;
  feels_like_celsius: number;
  humidity: number;
  description: string;
  wind_speed_mps: number;
  icon: string;
}

export interface ForecastDay {
  date: string;
  temperature_min: number;
  temperature_max: number;
  description: string;
  icon: string;
}

export interface Forecast {
  city: string;
  country: string;
  days: ForecastDay[];
}
```

- [ ] **Step 2: Create api.ts**

```typescript
import type {
  PermissionMapping,
  PermissionBody,
  KeycloakUser,
  KeycloakRole,
  User,
  Weather,
  Forecast,
} from './api.types';

let tokenGetter: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = tokenGetter();
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getMyPermissions: () =>
    request<{ routes: string[] }>('/api/me/permissions'),

  createUser: (body: { name: string; email: string }) =>
    request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getUser: (id: number) => request<User>(`/api/users/${id}`),

  listUsers: (params?: {
    search?: string;
    offset?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.offset != null) sp.set('offset', String(params.offset));
    if (params?.limit != null) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return request<{ items: KeycloakUser[]; total: number }>(
      `/api/users${qs ? `?${qs}` : ''}`,
    );
  },

  listPermissions: () => request<PermissionMapping[]>('/api/permissions'),

  createPermission: (body: PermissionBody) =>
    request<PermissionMapping>('/api/permissions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePermission: (id: number, body: PermissionBody) =>
    request<PermissionMapping>(`/api/permissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deletePermission: (id: number) =>
    request<void>(`/api/permissions/${id}`, { method: 'DELETE' }),

  reloadPermissionCache: () =>
    request<void>('/api/permissions/reload-cache', { method: 'POST' }),

  listRoles: () => request<KeycloakRole[]>('/api/roles'),

  createRole: (body: { name: string; description: string }) =>
    request<KeycloakRole>('/api/roles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteRole: (name: string) =>
    request<void>(`/api/roles/${name}`, { method: 'DELETE' }),

  assignRoles: (userId: string, roles: string[]) =>
    request<void>(`/api/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roles }),
    }),

  removeRoles: (userId: string, roles: string[]) =>
    request<void>(`/api/users/${userId}/roles`, {
      method: 'DELETE',
      body: JSON.stringify({ roles }),
    }),

  getWeather: (city: string) =>
    request<Weather>(`/api/weather/${encodeURIComponent(city)}`),

  getForecast: (city: string) =>
    request<Forecast>(
      `/api/weather/${encodeURIComponent(city)}/forecast`,
    ),
};
```

- [ ] **Step 3: Create auth-context.tsx**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Keycloak from 'keycloak-js';
import { setTokenGetter } from './api';
import type { AuthUser } from './api.types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  initialized: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): AuthUser {
  const payload = JSON.parse(atob(token.split('.')[1])) as Record<
    string,
    unknown
  >;
  return {
    id: payload.sub as string,
    email: (payload.email as string) ?? '',
    roles:
      ((payload.realm_access as { roles?: string[] })?.roles as string[]) ??
      [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    initialized: false,
  });
  const kcRef = useRef<Keycloak | null>(null);

  useEffect(() => {
    const kc = new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL,
      realm: import.meta.env.VITE_KEYCLOAK_REALM,
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    });
    kcRef.current = kc;

    const initPromise = kc.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri:
        window.location.origin + '/silent-check-sso.html',
      pkceMethod: 'S256',
    });

    // Matches Angular app's 3-second timeout — prevents infinite hang if Keycloak is unreachable
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 5000),
    );

    void Promise.race([initPromise, timeout]).then((authenticated) => {
      if (authenticated && kc.token) {
        const user = parseToken(kc.token);
        setTokenGetter(() => kc.token ?? null);
        setState({ user, token: kc.token, initialized: true });
      } else {
        console.warn('Running without authentication');
        setState((s) => ({ ...s, initialized: true }));
      }
    });

    kc.onTokenExpired = () => {
      void kc.updateToken(30).then((refreshed) => {
        if (refreshed && kc.token) {
          const user = parseToken(kc.token);
          setTokenGetter(() => kc.token ?? null);
          setState({ user, token: kc.token, initialized: true });
        }
      });
    };
  }, []);

  const login = useCallback(
    () => void kcRef.current?.login(),
    [],
  );
  const logout = useCallback(() => {
    setState({ user: null, token: null, initialized: true });
    setTokenGetter(() => null);
    void kcRef.current?.logout({
      redirectUri: window.location.origin,
    });
  }, []);

  const value: AuthContextValue = {
    ...state,
    isAuthenticated: state.user !== null,
    login,
    logout,
  };

  if (!state.initialized) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/core/
git commit -m "feat(main-react): add auth context, API layer, types

Keycloak integration via AuthProvider + useAuth hook.
Typed fetch wrapper with automatic Bearer token injection.
All API types matching the existing OpenAPI schema."
```

---

### Task 3: Permissions, Error Boundary, Protected Route

**Files:**
- Create: `apps/main/react-frontend/src/core/permissions-context.tsx`
- Create: `apps/main/react-frontend/src/core/error-boundary.tsx`
- Create: `apps/main/react-frontend/src/core/protected-route.tsx`

- [ ] **Step 1: Create permissions-context.tsx**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth-context';

interface PermissionsContextValue {
  allowedRoutes: string[];
  loaded: boolean;
  isRouteAllowed: (route: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(
  null,
);

export function PermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [allowedRoutes, setAllowedRoutes] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || loadedRef.current) return;
    loadedRef.current = true;
    void api.getMyPermissions().then(
      (res) => {
        setAllowedRoutes(res.routes);
        setLoaded(true);
      },
      () => setLoaded(true),
    );
  }, [isAuthenticated]);

  const isRouteAllowed = useCallback(
    (route: string) => {
      if (!loaded) return true;
      return allowedRoutes.includes(route);
    },
    [allowedRoutes, loaded],
  );

  return (
    <PermissionsContext.Provider
      value={{ allowedRoutes, loaded, isRouteAllowed }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error(
      'usePermissions must be used within PermissionsProvider',
    );
  return ctx;
}
```

- [ ] **Step 2: Create error-boundary.tsx**

```tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('Unhandled error:', error);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="p-lg">
          <h1>Something went wrong</h1>
          <p className="text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Create protected-route.tsx**

```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/core/permissions-context.tsx \
  apps/main/react-frontend/src/core/error-boundary.tsx \
  apps/main/react-frontend/src/core/protected-route.tsx
git commit -m "feat(main-react): add permissions, error boundary, route guard

PermissionsProvider fetches allowed routes on auth.
ProtectedRoute checks auth + permissions before rendering.
ErrorBoundary catches unhandled React errors."
```

---

### Task 4: Router + App Shell

**Files:**
- Create: `apps/main/react-frontend/src/routes.tsx`
- Create: `apps/main/react-frontend/src/app.tsx`
- Modify: `apps/main/react-frontend/src/main.tsx`

- [ ] **Step 1: Create routes.tsx**

```tsx
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
```

Note: Each feature file must `export default` its component for `lazy()` to work.

- [ ] **Step 2: Create app.tsx**

```tsx
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
```

- [ ] **Step 3: Update main.tsx to render App**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/app.tsx \
  apps/main/react-frontend/src/routes.tsx \
  apps/main/react-frontend/src/main.tsx
git commit -m "feat(main-react): add router, app shell, lazy-loaded routes

React Router v7 with createBrowserRouter. All feature routes lazy-loaded.
Protected routes via ProtectedRoute wrapper. AuthProvider + PermissionsProvider."
```

---

### Task 5: Public Pages (Landing, Register, Canary, Auth Callback)

**Files:**
- Create: `apps/main/react-frontend/src/features/landing.tsx`
- Create: `apps/main/react-frontend/src/features/register.tsx`
- Create: `apps/main/react-frontend/src/features/canary.tsx`
- Create: `apps/main/react-frontend/src/features/auth-callback.tsx`

- [ ] **Step 1: Create landing.tsx**

Port from `apps/main/frontend/src/app/features/landing/landing.component.ts`. Replace Angular template syntax with JSX, signals with useState:

```tsx
import { useState, type FormEvent } from 'react';
import { Button } from '@aspect/react-ui';

const stack = [
  'Angular 21',
  'FastAPI',
  'PostgreSQL',
  'Keycloak',
  'Docker',
  'Playwright',
];

export default function Landing() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-xl p-xl" style={{ minHeight: '100vh' }}>
      <span className="badge" data-variant="secondary">v0.1.0</span>
      <h1 className="text-4xl font-bold text-center">Boilerplate</h1>
      <p className="text-muted-foreground text-center" style={{ maxWidth: '36rem' }}>
        Production-grade full-stack starter with enterprise auth, design system, and automated testing.
      </p>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex gap-sm" style={{ width: '100%', maxWidth: '24rem' }}>
          <input
            className="input-base"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" size="lg">Get Started</Button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-sm">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-muted-foreground">Thanks! We'll be in touch.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-sm justify-center">
        {stack.map((tech) => (
          <span key={tech} className="badge" data-variant="outline">{tech}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create register.tsx**

Port from Angular. Replace ReactiveFormsModule with controlled inputs:

```tsx
import { useState, type FormEvent } from 'react';
import { Input, FormError, Button } from '@aspect/react-ui';
import { api } from '../core/api';

interface FormState {
  name: string;
  email: string;
}

export default function Register() {
  const [form, setForm] = useState<FormState>({ name: '', email: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors: Record<string, Record<string, true>> = {};
  if (!form.name.trim()) errors.name = { required: true };
  if (!form.email.trim()) errors.email = { required: true };
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = { email: true };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true });
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.createUser({ name: form.name, email: form.email });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-md p-xl" style={{ minHeight: '100vh' }}>
        <h2 className="text-2xl font-bold">Registration successful!</h2>
        <p className="text-muted-foreground">You can now log in.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-lg p-xl" style={{ minHeight: '100vh' }}>
      <h1 className="text-3xl font-bold">Register</h1>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-sm" style={{ width: '100%', maxWidth: '24rem' }}>
        <Input
          label="Name"
          value={form.name}
          onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        <FormError errors={errors.name} touched={touched.name} />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onValueChange={(v) => setForm((f) => ({ ...f, email: v }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />
        <FormError errors={errors.email} touched={touched.email} />
        <Button type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Register'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create canary.tsx**

```tsx
export default function Canary() {
  return <p className="p-lg text-muted-foreground">canary is alive</p>;
}
```

- [ ] **Step 4: Create auth-callback.tsx**

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
}
```

- [ ] **Step 5: Verify dev server renders landing page**

Run: `cd apps/main/react-frontend && npx vite`
Open: `http://localhost:4200`
Expected: Landing page renders with design system styling.

- [ ] **Step 6: Commit**

```bash
git add apps/main/react-frontend/src/features/landing.tsx \
  apps/main/react-frontend/src/features/register.tsx \
  apps/main/react-frontend/src/features/canary.tsx \
  apps/main/react-frontend/src/features/auth-callback.tsx
git commit -m "feat(main-react): add landing, register, canary, auth-callback pages

Landing: hero + email signup. Register: form with validation + API call.
Canary: build marker. Auth callback: redirect to home."
```

---

### Task 6: Protected Simple Pages (Dashboard, Weather, User Profile)

**Files:**
- Create: `apps/main/react-frontend/src/features/dashboard.tsx`
- Create: `apps/main/react-frontend/src/features/weather.tsx`
- Create: `apps/main/react-frontend/src/features/user-profile.tsx`

- [ ] **Step 1: Create dashboard.tsx**

Port from Angular. Uses HistogramTimeline and Badge from @aspect/react-ui. Keep the same seededRandom, generateBars, generateLabels helper functions:

```tsx
import { useMemo } from 'react';
import { Badge, HistogramTimeline, type HistogramBar, type HistogramLabel } from '@aspect/react-ui';

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function generateBars(count: number, seed: number): HistogramBar[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    value: Math.floor(rand() * 100),
  }));
}

function generateLabels(count: number, step: number): HistogramLabel[] {
  return Array.from({ length: Math.ceil(count / step) }, (_, i) => ({
    index: i * step,
    text: `${i * step}`,
  }));
}

interface StatCard {
  label: string;
  value: string;
  change: string;
}

interface ActivityItem {
  message: string;
  time: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

const stats: StatCard[] = [
  { label: 'Total Users', value: '2,847', change: '+12.5%' },
  { label: 'Active Sessions', value: '423', change: '+3.2%' },
  { label: 'API Calls', value: '1.2M', change: '+8.1%' },
  { label: 'Error Rate', value: '0.03%', change: '-15.4%' },
];

const activity: ActivityItem[] = [
  { message: 'User alice@example.com registered', time: '2 min ago', variant: 'default' },
  { message: 'API rate limit warning triggered', time: '15 min ago', variant: 'destructive' },
  { message: 'Database backup completed', time: '1 hour ago', variant: 'secondary' },
  { message: 'New deployment to staging', time: '3 hours ago', variant: 'outline' },
];

const systemInfo = [
  { label: 'Uptime', value: '99.97%' },
  { label: 'Response Time', value: '142ms' },
  { label: 'Memory Usage', value: '67%' },
  { label: 'CPU Load', value: '23%' },
];

export default function Dashboard() {
  const bars = useMemo(() => generateBars(24, 42), []);
  const labels = useMemo(() => generateLabels(24, 6), []);
  const errorBars = useMemo(() => generateBars(24, 99), []);
  const errorLabels = useMemo(() => generateLabels(24, 6), []);

  return (
    <div className="p-lg flex flex-col gap-lg">
      <div className="flex items-center gap-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Badge>Live</Badge>
      </div>

      <div className="grid gap-md" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className={`text-sm ${stat.change.startsWith('+') ? 'text-success' : 'text-destructive'}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2 className="card-title">Request Volume (24h)</h2>
          <HistogramTimeline bars={bars} labels={labels} ariaLabel="Request volume over 24 hours" />
        </div>
        <div className="card">
          <h2 className="card-title">Recent Activity</h2>
          <div className="flex flex-col gap-sm">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-sm">
                <span className="text-sm">{item.message}</span>
                <Badge variant={item.variant}>{item.time}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-md" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card">
          <h2 className="card-title">Error Rate (24h)</h2>
          <HistogramTimeline bars={errorBars} labels={errorLabels} ariaLabel="Error rate over 24 hours" variant="destructive" />
        </div>
        <div className="card">
          <h2 className="card-title">System</h2>
          <div className="flex flex-col gap-sm">
            {systemInfo.map((info) => (
              <div key={info.label} className="flex justify-between">
                <span className="text-sm text-muted-foreground">{info.label}</span>
                <span className="text-sm font-bold">{info.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create weather.tsx**

```tsx
import { useState } from 'react';
import { Button } from '@aspect/react-ui';
import { api } from '../core/api';
import type { Weather as WeatherData, Forecast } from '../core/api.types';

export default function Weather() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (type: 'weather' | 'forecast') => {
    const trimmed = city.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      if (type === 'weather') {
        setWeather(await api.getWeather(trimmed));
      } else {
        setForecast(await api.getForecast(trimmed));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-lg flex flex-col gap-lg" style={{ maxWidth: '40rem' }}>
      <h1 className="text-2xl font-bold">Weather</h1>
      <div className="flex gap-sm">
        <input
          className="input-base"
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void search('weather'); }}
          style={{ flex: 1 }}
        />
        <Button onClick={() => void search('weather')} disabled={loading}>Weather</Button>
        <Button variant="outline" onClick={() => void search('forecast')} disabled={loading}>Forecast</Button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {weather && (
        <div className="card">
          <h2 className="card-title">{weather.city}, {weather.country}</h2>
          <p>{weather.description}</p>
          <p className="text-2xl font-bold">{weather.temperature_celsius}°C</p>
          <p className="text-sm text-muted-foreground">
            Feels like {weather.feels_like_celsius}°C · Humidity {weather.humidity}% · Wind {weather.wind_speed_mps} m/s
          </p>
        </div>
      )}
      {forecast && (
        <div className="card">
          <h2 className="card-title">{forecast.city} — 5-Day Forecast</h2>
          <div className="grid gap-sm" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {forecast.days.map((day) => (
              <div key={day.date} className="p-sm text-center">
                <p className="text-sm font-bold">{day.date}</p>
                <p className="text-sm">{day.description}</p>
                <p className="text-sm">{day.temperature_min}° / {day.temperature_max}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create user-profile.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../core/api';
import type { User } from '../core/api.types';

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getUser(1).then(
      (data) => { setUser(data); setLoading(false); },
      (err) => { setError(err instanceof Error ? err.message : 'Failed'); setLoading(false); },
    );
  }, []);

  if (loading) return <div className="p-lg text-muted-foreground">Loading…</div>;
  if (error) return <div className="p-lg form-error">{error}</div>;
  if (!user) return null;

  return (
    <div className="p-lg flex flex-col gap-md" style={{ maxWidth: '32rem' }}>
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="card">
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p className="text-sm text-muted-foreground">Member since {new Date(user.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/features/dashboard.tsx \
  apps/main/react-frontend/src/features/weather.tsx \
  apps/main/react-frontend/src/features/user-profile.tsx
git commit -m "feat(main-react): add dashboard, weather, user-profile pages

Dashboard: stat cards, histogram timelines, activity feed.
Weather: city search with current + 5-day forecast.
User profile: simple user data display."
```

---

### Task 7: Admin Layout + Permissions Tab

**Files:**
- Create: `apps/main/react-frontend/src/features/admin/admin-layout.tsx`
- Create: `apps/main/react-frontend/src/features/admin/permissions-tab.tsx`
- Create: `apps/main/react-frontend/src/features/admin/permission-form.tsx`

- [ ] **Step 1: Create admin-layout.tsx**

```tsx
import { Outlet, NavLink } from 'react-router-dom';
import { PageLayout, PageHeader, TabNav } from '@aspect/react-ui';

export default function AdminLayout() {
  // TabLink from @aspect/react-ui wraps <a> — for React Router active-state
  // tracking, use NavLink directly with the same CSS classes.
  return (
    <PageLayout
      header={
        <PageHeader title="Administration" subtitle="Manage users and permissions" />
      }
    >
      <TabNav>
        <NavLink to="/admin/permissions" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
          Permissions
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
          Users
        </NavLink>
      </TabNav>
      <div className="p-lg">
        <Outlet />
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 2: Create permission-form.tsx**

```tsx
import { useState, useEffect, type FormEvent } from 'react';
import { Input, FormError, Button } from '@aspect/react-ui';
import type { PermissionMapping } from '../../core/api.types';

export interface PermissionFormValue {
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string;
}

interface Props {
  permission?: PermissionMapping | null;
  onSubmit: (value: PermissionFormValue) => void;
  onCancel: () => void;
}

export function PermissionForm({ permission, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<PermissionFormValue>({
    role: '',
    route_pattern: '',
    method: '',
    frontend_route: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (permission) {
      setForm({
        role: permission.role,
        route_pattern: permission.route_pattern,
        method: permission.method,
        frontend_route: permission.frontend_route ?? '',
      });
    }
  }, [permission]);

  const errors: Record<string, Record<string, true>> = {};
  if (!form.role.trim()) errors.role = { required: true };
  if (!form.route_pattern.trim()) errors.route_pattern = { required: true };
  if (!form.method.trim()) errors.method = { required: true };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ role: true, route_pattern: true, method: true });
    if (Object.keys(errors).length > 0) return;
    onSubmit(form);
  };

  const set = (key: keyof PermissionFormValue) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));
  const touch = (key: string) => () =>
    setTouched((t) => ({ ...t, [key]: true }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-sm">
      <Input label="Role" value={form.role} onValueChange={set('role')} onBlur={touch('role')} />
      <FormError errors={errors.role} touched={touched.role} />
      <Input label="Route Pattern" value={form.route_pattern} onValueChange={set('route_pattern')} onBlur={touch('route_pattern')} />
      <FormError errors={errors.route_pattern} touched={touched.route_pattern} />
      <Input label="Method" value={form.method} onValueChange={set('method')} onBlur={touch('method')} />
      <FormError errors={errors.method} touched={touched.method} />
      <Input label="Frontend Route" value={form.frontend_route} onValueChange={set('frontend_route')} />
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{permission ? 'Update' : 'Create'}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create permissions-tab.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Button, DataTable, DialogPanel, type DataTableColumn } from '@aspect/react-ui';
import { api } from '../../core/api';
import type { PermissionMapping } from '../../core/api.types';
import { PermissionForm, type PermissionFormValue } from './permission-form';

const columns: DataTableColumn<PermissionMapping>[] = [
  { accessor: 'role', header: 'Role', sortable: true },
  { accessor: 'route_pattern', header: 'Route Pattern', sortable: true },
  { accessor: 'method', header: 'Method', sortable: true },
  { accessor: 'frontend_route', header: 'Frontend Route' },
];

export default function PermissionsTab() {
  const [permissions, setPermissions] = useState<PermissionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PermissionMapping | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPermissions(await api.listPermissions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRowClick = (row: PermissionMapping) => {
    setEditing(row);
    setShowDialog(true);
  };

  const handleSubmit = async (value: PermissionFormValue) => {
    if (editing) {
      await api.updatePermission(editing.id, value);
    } else {
      await api.createPermission(value);
    }
    await api.reloadPermissionCache();
    setShowDialog(false);
    setEditing(null);
    await load();
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditing(null);
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowDialog(true); }}>
          Add Permission
        </Button>
      </div>
      <DataTable
        data={permissions}
        columns={columns}
        clickableRows
        onRowClick={handleRowClick}
      />
      {showDialog && (
        <DialogPanel
          title={<span>{editing ? 'Edit Permission' : 'Add Permission'}</span>}
          onClose={handleClose}
        >
          <PermissionForm
            permission={editing}
            onSubmit={(v) => void handleSubmit(v)}
            onCancel={handleClose}
          />
        </DialogPanel>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/features/admin/
git commit -m "feat(main-react): add admin layout, permissions tab, permission form

Tab navigation with nested routes. Data table with sortable columns.
Dialog for create/edit with form validation."
```

---

### Task 8: Users Tab + Roles Management

**Files:**
- Create: `apps/main/react-frontend/src/features/admin/users-tab.tsx`
- Create: `apps/main/react-frontend/src/features/admin/roles-management.tsx`
- Create: `apps/main/react-frontend/src/features/admin/user-roles-dialog.tsx`

- [ ] **Step 1: Create user-roles-dialog.tsx**

```tsx
import { useState, useMemo } from 'react';
import { DialogPanel, Badge, Button } from '@aspect/react-ui';
import { useAuth } from '../../core/auth-context';
import type { KeycloakUser, KeycloakRole } from '../../core/api.types';

const PROTECTED_ROLES = new Set(['admin', 'role_manager']);

interface Props {
  user: KeycloakUser;
  allRoles: KeycloakRole[];
  onClose: () => void;
  onSave: (added: string[], removed: string[]) => void;
}

export function UserRolesDialog({ user, allRoles, onClose, onSave }: Props) {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.roles.includes('admin') ?? false;

  const originalRoles = useMemo(
    () => new Set(user.roles.map((r) => r.name)),
    [user],
  );
  const [selected, setSelected] = useState(() => new Set(originalRoles));

  const hasChanges = useMemo(() => {
    if (selected.size !== originalRoles.size) return true;
    for (const r of selected) if (!originalRoles.has(r)) return true;
    return false;
  }, [selected, originalRoles]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSave = () => {
    const added = [...selected].filter((r) => !originalRoles.has(r));
    const removed = [...originalRoles].filter((r) => !selected.has(r));
    onSave(added, removed);
  };

  return (
    <DialogPanel
      title={<span>Roles for {user.username}</span>}
      onClose={onClose}
      footer={
        <div className="flex gap-sm justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!hasChanges}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-sm">
        {allRoles.map((role) => {
          const isProtected = PROTECTED_ROLES.has(role.name);
          return (
            <label key={role.name} className="flex items-center gap-sm">
              <input
                type="checkbox"
                checked={selected.has(role.name)}
                onChange={() => toggle(role.name)}
                disabled={isProtected && !isAdmin}
              />
              <span>{role.name}</span>
              {isProtected && <Badge variant="secondary">protected</Badge>}
            </label>
          );
        })}
      </div>
    </DialogPanel>
  );
}
```

- [ ] **Step 2: Create roles-management.tsx**

```tsx
import { useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  CollapsiblePanel,
  DialogPanel,
  Input,
  FormError,
} from '@aspect/react-ui';
import { useAuth } from '../../core/auth-context';
import type { KeycloakRole } from '../../core/api.types';

const UNDELETABLE_ROLES = new Set(['admin', 'role_manager', 'user']);

interface Props {
  roles: KeycloakRole[];
  onCreate: (name: string, description: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}

export function RolesManagement({ roles, onCreate, onDelete }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError =
    !name.trim()
      ? { required: true as const }
      : !/^[a-z][a-z0-9_]*$/.test(name)
        ? { pattern: true as const }
        : undefined;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (nameError) return;
    await onCreate(name, description);
    setName('');
    setDescription('');
    setTouched(false);
    setShowCreate(false);
  };

  return (
    <CollapsiblePanel header="Roles" variant="outline">
      <div className="flex flex-col gap-sm p-sm">
        {roles.map((role) => (
          <div key={role.name} className="flex items-center justify-between gap-sm">
            <div className="flex items-center gap-sm">
              <span>{role.name}</span>
              {UNDELETABLE_ROLES.has(role.name) && (
                <Badge variant="secondary">system</Badge>
              )}
            </div>
            {isAdmin && !UNDELETABLE_ROLES.has(role.name) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void onDelete(role.name)}
              >
                Delete
              </Button>
            )}
          </div>
        ))}
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            Create Role
          </Button>
        )}
      </div>
      {showCreate && (
        <DialogPanel
          title={<span>Create Role</span>}
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-sm">
            <Input label="Name" value={name} onValueChange={setName} onBlur={() => setTouched(true)} />
            <FormError errors={nameError} touched={touched} />
            <Input label="Description" value={description} onValueChange={setDescription} />
            <div className="flex justify-end gap-sm">
              <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogPanel>
      )}
    </CollapsiblePanel>
  );
}
```

- [ ] **Step 3: Create users-tab.tsx**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, DataTable, Input, type DataTableColumn } from '@aspect/react-ui';
import { api } from '../../core/api';
import type { KeycloakUser, KeycloakRole } from '../../core/api.types';
import { UserRolesDialog } from './user-roles-dialog';
import { RolesManagement } from './roles-management';

export default function UsersTab() {
  const [users, setUsers] = useState<KeycloakUser[]>([]);
  const [allRoles, setAllRoles] = useState<KeycloakRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<KeycloakUser | null>(null);

  const loadUsers = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.listUsers({ search: q, offset: 0, limit: 50 });
      setUsers(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      setAllRoles(await api.listRoles());
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadRoles();
  }, [loadUsers, loadRoles]);

  const handleSearch = (value: string) => {
    setSearch(value);
    void loadUsers(value || undefined);
  };

  const handleRolesChanged = async (added: string[], removed: string[]) => {
    if (!selectedUser) return;
    if (added.length > 0) await api.assignRoles(selectedUser.id, added);
    if (removed.length > 0) await api.removeRoles(selectedUser.id, removed);
    setSelectedUser(null);
    await loadUsers(search || undefined);
  };

  const columns: DataTableColumn<KeycloakUser>[] = [
    { accessor: 'username', header: 'Username' },
    { accessor: 'email', header: 'Email' },
    {
      accessor: 'enabled',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.enabled ? 'default' : 'destructive'}>
          {row.enabled ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      accessor: 'roles' as keyof KeycloakUser & string,
      header: 'Roles',
      cell: (row) => (
        <div className="flex flex-wrap gap-xs">
          {row.roles.map((r) => (
            <Badge
              key={r.name}
              variant={r.name === 'admin' ? 'default' : 'secondary'}
            >
              {r.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessor: 'id',
      header: '',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedUser(row)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <Input
        label="Search users"
        placeholder="Search by username or email"
        value={search}
        onValueChange={handleSearch}
      />
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <DataTable data={users} columns={columns} />
      )}
      <RolesManagement
        roles={allRoles}
        onCreate={async (name, desc) => {
          await api.createRole({ name, description: desc });
          await loadRoles();
        }}
        onDelete={async (name) => {
          await api.deleteRole(name);
          await loadRoles();
        }}
      />
      {selectedUser && (
        <UserRolesDialog
          user={selectedUser}
          allRoles={allRoles}
          onClose={() => setSelectedUser(null)}
          onSave={(added, removed) => void handleRolesChanged(added, removed)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/main/react-frontend/src/features/admin/users-tab.tsx \
  apps/main/react-frontend/src/features/admin/roles-management.tsx \
  apps/main/react-frontend/src/features/admin/user-roles-dialog.tsx
git commit -m "feat(main-react): add users tab, roles management, user roles dialog

Users tab: searchable data table with role badges and manage button.
Roles management: collapsible role list with create/delete.
User roles dialog: checkbox role assignment with protected role guards."
```

---

### Task 9: Build Integration

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Add react-frontend targets to Makefile**

Add these targets:

```makefile
REACT_FE = apps/main/react-frontend

dev-react-frontend: ## Start React frontend dev server (expects backend running)
	cd $(REACT_FE) && npx vite

test-react-frontend: ## Run React frontend tests
	cd $(REACT_FE) && npx vitest run

build-react-frontend: ## Build React frontend for production
	cd $(REACT_FE) && npx vite build
```

- [ ] **Step 2: Verify dev server works end-to-end**

Start backend: `make dev-backend`
Start React frontend: `make dev-react-frontend`
Open: `http://localhost:4200`

Verify:
- Landing page renders
- Navigation works
- Login via Keycloak (if running)
- Dashboard loads (when authenticated)
- Admin permissions tab shows data table

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: add React frontend Makefile targets

dev-react-frontend, test-react-frontend, build-react-frontend."
```

---

## Notes

**What this plan does NOT cover (follow-up work):**

- E2E test migration (Playwright tests exist for Angular — selectors may need updating for React)
- Storybook for React components (deferred — the @aspect/react-ui library will get its own Storybook later)
- Removing the Angular app (keep both until the React app is validated in production)
- The `weather` feature doesn't exist in `app.routes.ts` yet (it has routes file but isn't connected in the main routes — included here for completeness)
