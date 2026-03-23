import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../core/environment';

interface PermissionsResponse {
  routes: string[];
}

/**
 * Stores the current user's allowed frontend routes, fetched from the
 * RBAC backend. Exposes signals for route guards and navigation filtering.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsStore {
  private readonly http = inject(HttpClient);
  private readonly _allowedRoutes = signal<string[]>([]);
  private _loaded = false;

  /** Readonly signal of allowed frontend route paths. */
  readonly allowedRoutes = this._allowedRoutes.asReadonly();

  /** Computed: true when permissions have been fetched. */
  readonly loaded = computed(() => this._loaded);

  /** Check whether a given frontend route is allowed for the current user. */
  isRouteAllowed(route: string): boolean {
    const routes = this._allowedRoutes();
    // If no routes loaded yet, allow (guard should await load first)
    if (routes.length === 0 && !this._loaded) {
      return true;
    }
    return routes.includes(route);
  }

  /** Fetch allowed routes from the backend. Idempotent — only runs once. */
  async load(): Promise<void> {
    if (this._loaded) return;
    try {
      const resp = await firstValueFrom(
        this.http.get<PermissionsResponse>(`${environment.apiBaseUrl}/api/me/permissions`),
      );
      this._allowedRoutes.set(resp.routes);
    } catch {
      this._allowedRoutes.set([]);
    }
    this._loaded = true;
  }

  /** Reset state on logout. */
  clear(): void {
    this._allowedRoutes.set([]);
    this._loaded = false;
  }
}
