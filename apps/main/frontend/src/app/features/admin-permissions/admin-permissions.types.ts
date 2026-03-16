export interface PermissionMapping {
  id: number;
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email: string | null;
  enabled: boolean;
  roles: string[];
}

export interface KeycloakRole {
  id: string;
  name: string;
  description: string | null;
}
