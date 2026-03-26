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

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
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
    <PermissionsContext.Provider value={{ allowedRoutes, loaded, isRouteAllowed }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
