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
import { StressBarComponent } from "./stress-bar.component";

export interface ScoreState {
  turnNumber: number;
  nextDecisionTimeMs: number;
  stress: number;
  scoreTier: string | null;
}

@Component({
  selector: "tfc-score-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StressBarComponent],
  template: `
    <div class="score-bar">
      <div
        class="score-bar__vignette"
        [class.score-bar__vignette--active]="stressFlash"
      ></div>
      <span class="text-xs text-primary uppercase tracking-wide font-semibold"
        >Turn {{ score()?.turnNumber }}</span
      >
      <tfc-stress-bar [stress]="score()?.stress ?? 0" />
      <span class="flex-1"></span>
      @if (countdownMs() !== null && countdownMs()! > 0) {
        <span
          class="score-bar__countdown"
          [class.score-bar__countdown--urgent]="countdownMs()! < 30000"
        >
          {{ formattedCountdown }}
        </span>
      } @else if (score()?.nextDecisionTimeMs; as ms) {
        <span class="text-xs text-muted-foreground">
          Next in {{ ms / 1000 }}s
        </span>
      }
    </div>
  `,
})
export class ScoreBarComponent implements AfterViewInit, OnChanges {
  readonly score = input<ScoreState | null>(null);
  readonly countdownMs = input<number | null>(null);
  private readonly anim = inject(AnimationService);
  private readonly el = inject(ElementRef);
  private initialized = false;
  private prevStress = 0;
  protected stressFlash = false;

  protected get formattedCountdown(): string {
    const ms = this.countdownMs() ?? 0;
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  ngAfterViewInit(): void {
    this.initialized = true;
    this.prevStress = this.score()?.stress ?? 0;
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    const s = this.score();
    if (!s) return;

    if (s.stress > this.prevStress) {
      this.stressFlash = true;
      this.anim.shake(
        this.el.nativeElement.querySelector(".score-bar"),
        2,
        0.3,
      );
      setTimeout(() => {
        this.stressFlash = false;
      }, 800);
    }
    this.prevStress = s.stress;
  }
}
