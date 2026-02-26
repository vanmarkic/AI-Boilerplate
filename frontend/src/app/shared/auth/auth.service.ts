import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(true); // STUB: always authenticated
  readonly currentUser = signal<AuthUser>({
    id: 'stub-user-1',
    email: 'dev@local.dev',
    roles: ['admin'],
  });

  getToken(): string {
    return 'stub-token'; // STUB: replace with real token retrieval
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null as unknown as AuthUser);
  }
}
