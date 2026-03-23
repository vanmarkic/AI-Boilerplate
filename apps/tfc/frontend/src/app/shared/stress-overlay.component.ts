import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
} from "@angular/core";
import { DOCUMENT } from "@angular/common";

type StressPreset = "off" | "mild" | "standard" | "intense";

interface PresetConfig {
  vignetteMax: number;
  bpmLow: number;
  bpmHigh: number;
  shakeOnset: number;
  shakeMag: number;
}

const PRESETS: Record<Exclude<StressPreset, "off">, PresetConfig> = {
  mild: {
    vignetteMax: 0.25,
    bpmLow: 50,
    bpmHigh: 80,
    shakeOnset: 10,
    shakeMag: 1,
  },
  standard: {
    vignetteMax: 0.4,
    bpmLow: 60,
    bpmHigh: 120,
    shakeOnset: 9,
    shakeMag: 1.5,
  },
  intense: {
    vignetteMax: 0.55,
    bpmLow: 70,
    bpmHigh: 160,
    shakeOnset: 8,
    shakeMag: 2.5,
  },
};

@Component({
  selector: "tfc-stress-overlay",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "stress-overlay-host",
  },
  template: `
    @if (severity() > 0) {
      <div
        class="stress-overlay"
        [style.--stress-severity]="severity()"
        [style.--stress-vignette-max]="vignetteMax()"
        [style.--stress-pulse-duration]="pulseDuration()"
      ></div>
    }
  `,
})
export class StressOverlayComponent {
  readonly stress = input(0);
  readonly preset = input<StressPreset>("standard");

  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly shakeEffect = effect(() => {
    const mag = this.shakeMag();
    const body = this.doc.body;
    if (mag === "0px") {
      body.classList.remove("stress-shaking");
      body.style.removeProperty("--stress-shake");
    } else {
      body.style.setProperty("--stress-shake", mag);
      body.classList.add("stress-shaking");
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.doc.body.classList.remove("stress-shaking");
      this.doc.body.style.removeProperty("--stress-shake");
    });
  }

  protected readonly severity = computed(() => {
    if (this.preset() === "off") return 0;
    const s = this.stress();
    if (s < 7) return 0;
    return Math.min((s - 7) / 3, 1);
  });

  private readonly config = computed(() => {
    const p = this.preset();
    if (p === "off") return null;
    return PRESETS[p];
  });

  protected readonly vignetteMax = computed(
    () => this.config()?.vignetteMax ?? 0,
  );

  protected readonly pulseDuration = computed(() => {
    const c = this.config();
    if (!c) return "0s";
    const sev = this.severity();
    const bpm = c.bpmLow + (c.bpmHigh - c.bpmLow) * sev;
    return `${(60 / bpm).toFixed(2)}s`;
  });

  protected readonly shakeMag = computed(() => {
    const c = this.config();
    if (!c) return "0px";
    const s = this.stress();
    if (s < c.shakeOnset) return "0px";
    const shakeProgress = Math.min((s - c.shakeOnset) / (10 - c.shakeOnset), 1);
    return `${(c.shakeMag * shakeProgress).toFixed(1)}px`;
  });
}
