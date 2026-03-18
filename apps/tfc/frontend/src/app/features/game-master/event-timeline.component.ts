import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from "@angular/core";
import type {
  EventSnapshot,
  IssueSnapshot,
} from "../../core/engine-api.service";
import { DomainService } from "../../core/domain.service";
import { TimelineLaneComponent } from "./timeline-lane.component";
import { computeTimelineItems, computeTimeScale } from "./timeline-utils";

const DEFAULT_WIDTH_PX = 1200;

@Component({
  selector: "tfc-event-timeline",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineLaneComponent],
  template: `
    <div class="timeline-container" #scrollContainer>
      <div class="timeline-track" [style.width.px]="trackWidthPx()">
        <div class="timeline-axis">
          @for (tick of axisTicks(); track tick.ms) {
            <span class="timeline-tick" [style.left.px]="tick.px">
              {{ tick.label }}
            </span>
          }
        </div>

        <div class="timeline-lane-group">
          <span class="timeline-lane-group__label"
            >{{ domain.term("event") }}s</span
          >
          <tfc-timeline-lane
            [items]="timeline().eventItems"
            [scale]="scale()"
          />
        </div>

        <div class="timeline-lane-group">
          <span class="timeline-lane-group__label"
            >{{ domain.term("issue") }}s</span
          >
          <tfc-timeline-lane
            [items]="timeline().issueItems"
            [scale]="scale()"
          />
        </div>

        <div class="timeline-now-marker" [style.left.px]="nowMarkerPx()"></div>
      </div>
    </div>
  `,
  host: { class: "event-timeline" },
})
export class EventTimelineComponent {
  readonly events = input<EventSnapshot[]>([]);
  readonly issues = input<IssueSnapshot[]>([]);
  readonly playTimeMs = input(0);

  protected readonly domain = inject(DomainService);
  private readonly scrollRef =
    viewChild<ElementRef<HTMLElement>>("scrollContainer");

  protected readonly timeline = computed(() =>
    computeTimelineItems(this.events(), this.issues(), this.playTimeMs()),
  );

  protected readonly scale = computed(() => {
    const all = [...this.timeline().eventItems, ...this.timeline().issueItems];
    return computeTimeScale(all, this.playTimeMs(), DEFAULT_WIDTH_PX);
  });

  protected readonly trackWidthPx = computed(() =>
    Math.max(this.scale().totalMs * this.scale().pxPerMs, DEFAULT_WIDTH_PX),
  );

  protected readonly nowMarkerPx = computed(
    () => this.playTimeMs() * this.scale().pxPerMs,
  );

  protected readonly axisTicks = computed(() => {
    const { totalMs, pxPerMs } = this.scale();
    const interval = pickTickInterval(totalMs);
    const ticks: { ms: number; px: number; label: string }[] = [];
    for (let ms = 0; ms <= totalMs; ms += interval) {
      ticks.push({ ms, px: ms * pxPerMs, label: formatTickLabel(ms) });
    }
    return ticks;
  });

  constructor() {
    effect(() => {
      const markerPx = this.nowMarkerPx();
      const el = this.scrollRef()?.nativeElement;
      if (el) {
        const target = markerPx - el.clientWidth * 0.7;
        el.scrollLeft = Math.max(0, target);
      }
    });
  }
}

function pickTickInterval(totalMs: number): number {
  if (totalMs <= 120_000) return 10_000;
  if (totalMs <= 600_000) return 60_000;
  if (totalMs <= 3_600_000) return 300_000;
  return 600_000;
}

function formatTickLabel(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0
    ? `${minutes}m`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}
