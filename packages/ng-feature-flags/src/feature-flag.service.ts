import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly flags = signal<Record<string, boolean>>({});

  /**
   * Initialize flags from API or environment.
   * Call this on app bootstrap.
   */
  setFlags(flags: Record<string, boolean>): void {
    this.flags.set(flags);
  }

  /**
   * Check if a feature is enabled.
   * Default: true (all shipped features are active).
   */
  isEnabled(feature: string): boolean {
    return this.flags()[feature] ?? true;
  }
}
