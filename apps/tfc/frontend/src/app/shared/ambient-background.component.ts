import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tfc-ambient-background',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ambient-bg' },
  template: `
    <div class="ambient-bg__gradient"></div>
    <svg class="ambient-bg__waves" viewBox="0 0 2880 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40 C360 20 720 60 1080 40 C1260 30 1380 50 1440 40
        C1800 20 2160 60 2520 40 C2700 30 2820 50 2880 40 L2880 80 L0 80 Z"
        fill="currentColor" opacity="0.04"/>
      <path d="M0 50 C240 30 480 65 720 45 C960 25 1200 60 1440 50
        C1680 30 1920 65 2160 45 C2400 25 2640 60 2880 50 L2880 80 L0 80 Z"
        fill="currentColor" opacity="0.06"/>
      <path d="M0 60 C180 50 360 70 540 55 C720 40 900 65 1080 55 C1260 45 1440 55
        C1620 50 1800 70 1980 55 C2160 40 2340 65 2520 55 C2700 45 2880 55 2880 55
        L2880 80 L0 80 Z"
        fill="currentColor" opacity="0.08"/>
    </svg>
    <div class="ambient-bg__fog" [class.ambient-bg__fog--active]="fogActive()"></div>
  `,
})
export class AmbientBackgroundComponent {
  readonly fogActive = input(false);
}
