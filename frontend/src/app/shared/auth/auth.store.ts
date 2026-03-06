import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const initialState: AuthState = {
  user: { id: 'stub-user-1', email: 'dev@local.dev', roles: ['admin'] }, // STUB
  token: 'stub-token', // STUB
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
  })),
  withMethods((store) => ({
    login(user: AuthUser, token: string): void {
      patchState(store, { user, token });
    },
    logout(): void {
      patchState(store, { user: null, token: null });
    },
  })),
);
