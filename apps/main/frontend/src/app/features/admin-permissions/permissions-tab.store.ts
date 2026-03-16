import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  listPermissionsApiAdminPermissionsGet,
  createPermissionApiAdminPermissionsPost,
  updatePermissionApiAdminPermissionsPermIdPut,
  deletePermissionApiAdminPermissionsPermIdDelete,
  reloadPermissionsApiAdminPermissionsReloadPost,
} from '../../shared/api/generated';
import type { PermissionMapping } from './admin-permissions.types';

interface PermissionsTabState {
  permissions: PermissionMapping[];
  loading: boolean;
  error: string | null;
}

export const PermissionsTabStore = signalStore(
  withState<PermissionsTabState>({
    permissions: [],
    loading: false,
    error: null,
  }),
  withMethods((store) => ({
    async loadPermissions(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const { data } = await listPermissionsApiAdminPermissionsGet();
        patchState(store, {
          permissions: (data as PermissionMapping[]) ?? [],
          loading: false,
        });
      } catch (e) {
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load permissions',
        });
      }
    },
    async createPermission(body: {
      role: string;
      route_pattern: string;
      method: string;
      frontend_route: string | null;
    }): Promise<void> {
      await createPermissionApiAdminPermissionsPost({ body });
      await this.loadPermissions();
    },
    async updatePermission(
      id: number,
      body: {
        role?: string;
        route_pattern?: string;
        method?: string;
        frontend_route?: string | null;
      },
    ): Promise<void> {
      await updatePermissionApiAdminPermissionsPermIdPut({
        path: { perm_id: id },
        body,
      });
      await this.loadPermissions();
    },
    async deletePermission(id: number): Promise<void> {
      await deletePermissionApiAdminPermissionsPermIdDelete({
        path: { perm_id: id },
      });
      await this.loadPermissions();
    },
    async reloadCache(): Promise<void> {
      await reloadPermissionsApiAdminPermissionsReloadPost();
    },
  })),
);
