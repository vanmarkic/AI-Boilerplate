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
