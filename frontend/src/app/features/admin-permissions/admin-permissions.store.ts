import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { withResource } from '../../shared/data/with-resource';
import { PermissionMapping } from './admin-permissions.types';

export const AdminPermissionsStore = signalStore(
  { providedIn: 'root' },
  withResource<PermissionMapping>(),
  withMethods((store) => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async load(id: number): Promise<void> {
      const result = await store.run('load permission', async () => {
        // TODO: Replace with generated API call after `make generate`
        // import { getPermission } from '../../shared/api/generated';
        // const { data } = await getPermission({ path: { perm_id: id } });
        // return data;
        return await Promise.reject(
          new Error('Not implemented — run make generate first')
        );
      });
      if (result) {
        patchState(store, { item: result });
      }
    },
  })),
);
