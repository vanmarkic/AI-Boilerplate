import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  listUsersApiAdminUsersGet,
  listRolesApiAdminRolesGet,
  assignRolesApiAdminUsersUserIdRolesPost,
  removeRolesApiAdminUsersUserIdRolesDelete,
  createRoleApiAdminRolesPost,
  deleteRoleApiAdminRolesRoleNameDelete,
} from '../../shared/api/generated';
import type { KeycloakRole, KeycloakUser } from './admin-permissions.types';

interface UsersTabState {
  users: KeycloakUser[];
  allRoles: KeycloakRole[];
  total: number;
  loading: boolean;
  error: string | null;
  search: string;
}

export const UsersTabStore = signalStore(
  withState<UsersTabState>({
    users: [],
    allRoles: [],
    total: 0,
    loading: false,
    error: null,
    search: '',
  }),
  withMethods((store) => ({
    async loadUsers(search?: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const { data } = await listUsersApiAdminUsersGet({
          query: { search: search ?? undefined, offset: 0, limit: 50 },
        });
        const body = data as { users: KeycloakUser[]; total: number } | undefined;
        patchState(store, {
          users: body?.users ?? [],
          total: body?.total ?? 0,
          loading: false,
          search: search ?? '',
        });
      } catch (e) {
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load users',
        });
      }
    },
    async loadRoles(): Promise<void> {
      try {
        const { data } = await listRolesApiAdminRolesGet();
        const body = data as { roles: KeycloakRole[] } | undefined;
        patchState(store, { allRoles: body?.roles ?? [] });
      } catch {
        /* roles load failure is non-critical */
      }
    },
    async assignRoles(userId: string, roleNames: string[]): Promise<void> {
      await assignRolesApiAdminUsersUserIdRolesPost({
        path: { user_id: userId },
        body: { role_names: roleNames },
      });
      await this.loadUsers(store.search());
    },
    async removeRoles(userId: string, roleNames: string[]): Promise<void> {
      await removeRolesApiAdminUsersUserIdRolesDelete({
        path: { user_id: userId },
        body: { role_names: roleNames },
      });
      await this.loadUsers(store.search());
    },
    async createRole(name: string, description: string): Promise<void> {
      await createRoleApiAdminRolesPost({ body: { name, description } });
      await this.loadRoles();
    },
    async deleteRole(name: string): Promise<void> {
      await deleteRoleApiAdminRolesRoleNameDelete({ path: { role_name: name } });
      await this.loadRoles();
    },
  })),
);
