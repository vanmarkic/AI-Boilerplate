import { Injectable, signal } from '@angular/core';
import { createUser } from '../../shared/api/generated';
import { RegisterFormValue } from './register.types';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  async register(data: RegisterFormValue): Promise<void> {
    this.loading.set(true);
    this.success.set(false);
    this.error.set(null);
    try {
      await createUser({ body: { email: data.email, name: data.name } });
      this.success.set(true);
    } catch {
      this.error.set('Registration failed. The email may already be in use.');
    } finally {
      this.loading.set(false);
    }
  }
}
