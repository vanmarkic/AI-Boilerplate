import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  ElementRef,
  OnChanges,
  AfterViewInit,
} from "@angular/core";
import { AnimationService } from "../core/animation.service";

export interface ScoreState {
  totalScore: number;
  turnNumber: number;
  nextDecisionTimeMs: number;
  penaltyMs?: number;
}

@Component({
  selector: "tfc-score-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="score-bar">
      <div
        class="score-bar__vignette"
        [class.score-bar__vignette--active]="penaltyActive"
      ></div>
      <span class="text-xs text-primary uppercase tracking-wide font-semibold"
        >Turn {{ score()?.turnNumber }}</span
      >
      <span class="text-xs text-muted-foreground uppercase tracking-wide"
        >Score</span
      >
      <span class="score-bar__value">{{ displayScore }}</span>
      <span class="flex-1"></span>
      @if (score()?.nextDecisionTimeMs; as ms) {
        <span class="text-xs text-muted-foreground">
          Next in {{ ms / 1000 }}s
        </span>
      }
    </div>
  `,
})
export class ScoreBarComponent implements AfterViewInit, OnChanges {
  readonly score = input<ScoreState | null>(null);
  private readonly anim = inject(AnimationService);
  private readonly el = inject(ElementRef);
  private initialized = false;
  private prevScore = 0;
  protected displayScore = 0;
  protected penaltyActive = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    this.displayScore = this.score()?.totalScore ?? 0;
    this.prevScore = this.displayScore;
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    const s = this.score();
    if (!s) return;

    if (s.totalScore !== this.prevScore) {
      this.anim.counter(this.prevScore, s.totalScore, (v) => {
        this.displayScore = v;
      });
      this.prevScore = s.totalScore;
    }

    if (s.penaltyMs && s.penaltyMs > 0) {
      this.penaltyActive = true;
      this.anim.shake(
        this.el.nativeElement.querySelector(".score-bar"),
        2,
        0.3,
      );
      setTimeout(() => {
        this.penaltyActive = false;
      }, 800);
    }
  }
}
