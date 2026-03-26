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
