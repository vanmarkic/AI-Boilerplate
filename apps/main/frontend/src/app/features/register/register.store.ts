import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { createUser } from '../../shared/api/generated';
import { RegisterFormValue } from './register.types';

interface RegisterState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

export const RegisterStore = signalStore(
  withState<RegisterState>({ loading: false, success: false, error: null }),
  withMethods((store) => ({
    async register(data: RegisterFormValue): Promise<void> {
      patchState(store, { loading: true, success: false, error: null });
      try {
        await createUser({ body: { email: data.email, name: data.name } });
        patchState(store, { success: true });
      } catch {
        patchState(store, { error: 'Registration failed. The email may already be in use.' });
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
);
