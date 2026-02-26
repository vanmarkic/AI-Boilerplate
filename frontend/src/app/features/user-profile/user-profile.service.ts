import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from './user-profile.types';
import { environment } from '../../core/environment';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly http = inject(HttpClient);

  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadUser(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.get<User>(`${environment.apiBaseUrl}/api/users/${id}`)
      );
      this.user.set(result);
    } catch {
      this.error.set('Failed to load user');
    } finally {
      this.loading.set(false);
    }
  }
}
