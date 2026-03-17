import {
  ChangeDetectionStrategy, Component, input, inject,
  AfterViewInit, ElementRef, OnChanges,
} from '@angular/core';
import { AnimationService } from '../core/animation.service';

@Component({
  selector: 'tfc-turn-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="turn-banner">
      <svg class="turn-banner__layer turn-banner__layer--sky"
        viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
        <rect width="1440" height="200" fill="url(#sky-grad)"/>
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.02"/>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.08"/>
          </linearGradient>
        </defs>
      </svg>

      <svg class="turn-banner__layer turn-banner__layer--land"
        viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 160 L100 150 L200 155 L320 140 L440 135 L560 130
          L700 140 L860 138 L1020 136 L1200 148 L1440 155 L1440 200 L0 200 Z"
          fill="currentColor" opacity="0.06"/>
        <rect x="420" y="120" width="6" height="20" fill="currentColor" opacity="0.08"/>
        <rect x="430" y="115" width="4" height="25" fill="currentColor" opacity="0.07"/>
        <rect x="850" y="118" width="5" height="22" fill="currentColor" opacity="0.08"/>
      </svg>

      <div class="turn-banner__layer turn-banner__layer--ship">
        <svg viewBox="0 0 200 60" aria-hidden="true">
          <g opacity="0.7">
            <path d="M10 40 L30 48 L170 48 L195 40 L180 36 L20 36 Z" fill="currentColor"/>
            <rect x="60" y="24" width="50" height="12" rx="1" fill="currentColor"/>
            <rect x="70" y="16" width="30" height="8" rx="1" fill="currentColor"/>
            <line x1="85" y1="6" x2="85" y2="16" stroke="currentColor" stroke-width="2"/>
            <circle cx="85" cy="5" r="3" fill="currentColor"/>
            <rect x="120" y="20" width="8" height="16" rx="1" fill="currentColor"/>
            <rect x="42" y="30" width="12" height="4" rx="1" fill="currentColor"/>
          </g>
        </svg>
      </div>

      <div class="turn-banner__label">{{ label() }}</div>
    </div>
  `,
})
export class TurnBannerComponent implements AfterViewInit, OnChanges {
  readonly label = input('');
  readonly turnNumber = input(0);
  private readonly anim = inject(AnimationService);
  private readonly el = inject(ElementRef);
  private initialized = false;
  private lastTurn = 0;

  ngAfterViewInit(): void {
    this.initialized = true;
    this.playEntrance();
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    const current = this.turnNumber();
    if (current !== this.lastTurn) {
      this.lastTurn = current;
      this.playEntrance();
    }
  }

  private playEntrance(): void {
    const root = this.el.nativeElement;
    const sky = root.querySelector('.turn-banner__layer--sky');
    const land = root.querySelector('.turn-banner__layer--land');
    const ship = root.querySelector('.turn-banner__layer--ship');
    const label = root.querySelector('.turn-banner__label');

    const tl = this.anim.timeline();
    if (!tl) return;

    tl.fromTo(sky, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' })
      .fromTo(land, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .fromTo(ship, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
      .fromTo(label, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.2');
  }
}
