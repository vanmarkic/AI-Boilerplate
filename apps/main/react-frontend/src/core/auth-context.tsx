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

    // Matches Angular app's timeout — prevents infinite hang if Keycloak is unreachable
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
