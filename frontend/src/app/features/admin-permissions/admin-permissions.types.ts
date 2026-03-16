export interface PermissionMapping {
  id: number;
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string | null;
  created_at: string;
  updated_at: string;
}
