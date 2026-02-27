import { Injectable, signal } from '@angular/core';
import { getUser } from '../../shared/api/generated';
import { User } from './user-profile.types';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadUser(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const { data } = await getUser({ path: { id } });
      this.user.set(data ?? null);
    } catch {
      this.error.set('Failed to load user');
    } finally {
      this.loading.set(false);
    }
  }
}
