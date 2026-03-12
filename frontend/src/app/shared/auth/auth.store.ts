import { computed, Injectable, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../core/environment';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly keycloak = new Keycloak({
    url: environment.keycloak.url,
    realm: environment.keycloak.realm,
    clientId: environment.keycloak.clientId,
  });

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _token = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  async init(): Promise<void> {
    try {
      const authenticated = await Promise.race([
        this.keycloak.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
          pkceMethod: 'S256',
        }),
        new Promise<boolean>((_, reject) => {
          setTimeout(() => { reject(new Error('Keycloak init timeout')); }, 3_000);
        }),
      ]);

      if (authenticated) {
        this.updateUserFromToken();
      }

      this.keycloak.onTokenExpired = () => {
        void this.keycloak.updateToken(30).then((refreshed) => {
          if (refreshed) {
            this.updateUserFromToken();
          }
        });
      };
    } catch {
      console.warn('Keycloak unavailable — running without auth');
    }
  }

  login(): void {
    void this.keycloak.login();
  }

  logout(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin });
  }

  private updateUserFromToken(): void {
    const parsed = this.keycloak.tokenParsed;
    if (parsed) {
      this._user.set({
        id: parsed.sub ?? '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        email: parsed['email'] ?? '',
        roles: parsed.realm_access?.roles ?? [],
      });
      this._token.set(this.keycloak.token ?? null);
    }
  }
}
