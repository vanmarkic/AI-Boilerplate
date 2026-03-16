import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { getUser } from '../../shared/api/generated';
import { withResource } from '../../shared/data/with-resource';
import { User } from './user-profile.types';

export const UserProfileStore = signalStore(
  { providedIn: 'root' },
  withResource<User>(),
  withMethods((store) => ({
    async loadUser(id: number): Promise<void> {
      const result = await store.run('load user', async () => {
        const { data } = await getUser({ path: { user_id: id } });
        return data as User;
      });
      if (result) {
        patchState(store, { item: result });
      }
    },
  })),
);
