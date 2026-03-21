import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { ButtonDirective } from "@aspect/ui";

export type ScoreTier = "lo" | "mid" | "hi";

const TIER_CONFIG: Record<ScoreTier, { heading: string; message: string }> = {
  lo: {
    heading: "Solid Effort",
    message:
      "Your team showed real determination under pressure. Every exercise builds experience — take what you learned and bring it to the next one.",
  },
  mid: {
    heading: "Great Performance",
    message:
      "Your team demonstrated strong decision-making skills and kept composure when it mattered. Well done — that kind of teamwork makes a real difference.",
  },
  hi: {
    heading: "Outstanding",
    message:
      "Your team achieved exceptional results. Decisive action, clear communication, and excellent judgment throughout. Truly impressive work.",
  },
};

const FALLBACK = {
  heading: "Exercise Complete",
  message: "Well done — the exercise has concluded. Thank you for your participation and effort.",
};

@Component({
  selector: "tfc-completion-overlay",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  host: { class: "completion-overlay" },
  template: `
    <div class="completion-overlay__backdrop"></div>
    <div class="completion-overlay__panel">
      <header class="completion-overlay__header">
        <h1 class="completion-overlay__title">{{ config.heading }}</h1>
      </header>

      <div class="completion-overlay__body">
        <p class="completion-overlay__message">{{ config.message }}</p>
      </div>

      <footer class="completion-overlay__footer">
        <button
          uiButton
          variant="default"
          size="lg"
          (click)="closed.emit()"
        >
          Return to Home
        </button>
      </footer>
    </div>
  `,
})
export class CompletionOverlayComponent {
  readonly tier = input<string | null>(null);
  readonly closed = output();

  protected get config(): { heading: string; message: string } {
    const t = this.tier();
    if (t && t in TIER_CONFIG) {
      return TIER_CONFIG[t as ScoreTier];
    }
    return FALLBACK;
  }
}
