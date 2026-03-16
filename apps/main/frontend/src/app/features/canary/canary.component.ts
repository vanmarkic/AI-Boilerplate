import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Canary tier-2 component — used only for build-filtering verification. */
@Component({
  selector: 'app-canary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>CANARY_TIER2_FRONTEND_MARKER</p>',
})
export class CanaryComponent {}
