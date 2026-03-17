import {
  ChangeDetectionStrategy, Component, input, inject,
  AfterViewInit, ElementRef, OnChanges,
} from '@angular/core';
import { AnimationService } from '../core/animation.service';

export interface AdvisorRecommendation {
  participantId: string;
  participantName: string;
  optionId: string;
}

@Component({
  selector: 'tfc-advisor-bubbles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-xs">
      @for (rec of recommendations(); track rec.participantId) {
        <div class="advisor-bubble">
          <span class="advisor-bubble__avatar">{{ initial(rec.participantName) }}</span>
          <span class="text-muted-foreground">{{ rec.participantName }}</span>
        </div>
      }
      @if (recommendations().length > 0) {
        <span class="advisor-bubble__count"
          [class.advisor-bubble__count--bounce]="bouncing">
          {{ recommendations().length }}
        </span>
      }
    </div>
  `,
})
export class AdvisorBubblesComponent implements AfterViewInit, OnChanges {
  readonly recommendations = input<AdvisorRecommendation[]>([]);
  private readonly anim = inject(AnimationService);
  private readonly el = inject(ElementRef);
  private initialized = false;
  private prevCount = 0;
  protected bouncing = false;

  protected initial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    this.animateBubbles();
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    const count = this.recommendations().length;
    if (count > this.prevCount) {
      this.animateBubbles();
      this.bouncing = true;
      setTimeout(() => { this.bouncing = false; }, 250);
    }
    this.prevCount = count;
  }

  private animateBubbles(): void {
    const bubbles = this.el.nativeElement.querySelectorAll('.advisor-bubble');
    this.anim.staggerIn(bubbles, {
      y: 8, scale: 0.8, duration: 0.35, stagger: 0.06,
    });
  }
}
