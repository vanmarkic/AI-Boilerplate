import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  PageHeaderComponent,
  CardComponent,
  BadgeComponent,
  ButtonDirective,
} from "@aspect/ui";
import { AuditApiService, AuditEntry } from "../../core/audit-api.service";
import { formatTimeMs } from "../../core/format-time";

@Component({
  selector: "tfc-review-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    CardComponent,
    BadgeComponent,
    ButtonDirective,
  ],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <ui-page-header title="Exercise Review" />

      <!-- Playback controls -->
      <ui-card title="Timeline Replay">
        <div class="flex flex-col gap-sm p-sm">
          <div class="flex items-center gap-md">
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="stepBack()"
              [disabled]="replayIndex() <= 0"
            >
              Prev
            </button>
            <button
              uiButton
              [variant]="playing() ? 'destructive' : 'default'"
              size="sm"
              (click)="togglePlay()"
            >
              {{ playing() ? "Pause" : "Play" }}
            </button>
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="stepForward()"
              [disabled]="replayIndex() >= sortedLog().length"
            >
              Next
            </button>
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="resetReplay()"
            >
              Reset
            </button>
            <span class="text-sm text-muted-foreground">
              {{ replayIndex() }} / {{ sortedLog().length }}
            </span>
            <div class="flex items-center gap-xs" style="margin-left: auto">
              <span class="text-xs text-muted-foreground">Speed:</span>
              <select
                class="input-base"
                style="width: var(--container-xs, 5rem)"
                [value]="playbackSpeed()"
                (change)="onSpeedChange($event)"
              >
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="5">5x</option>
              </select>
            </div>
          </div>
          <div
            style="width: 100%; height: var(--radius-md); background: var(--color-muted); border-radius: var(--radius-sm); position: relative;"
          >
            <div
              style="height: 100%; border-radius: var(--radius-sm); transition: width 0.2s;"
              [style.width.%]="progressPercent()"
              [style.background]="'var(--color-primary)'"
            ></div>
          </div>
          @if (currentEntry(); as entry) {
            <div
              class="flex items-center gap-md p-sm"
              style="background: var(--color-muted); border-radius: var(--radius-sm)"
            >
              <span class="text-sm font-medium">{{ entry.action }}</span>
              <ui-badge variant="secondary">{{ entry.entry_type }}</ui-badge>
              @if (entry.target_id) {
                <span class="text-xs text-muted-foreground">
                  target: {{ entry.target_id }}
                </span>
              }
              <span
                class="text-xs text-muted-foreground"
                style="margin-left: auto"
              >
                PT {{ formatTime(entry.play_time_ms) }}
              </span>
            </div>
          }
        </div>
      </ui-card>

      <div class="grid grid-cols-3 gap-md">
        <ui-card title="Visible Timeline">
          @for (entry of visibleEntries(); track entry.id) {
            <div
              class="flex items-center justify-between p-sm border-b"
              [style.opacity]="isHighlighted(entry) ? '1' : '0.6'"
            >
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ entry.action }}</span>
                <span class="text-xs text-muted-foreground">
                  PT {{ formatTime(entry.play_time_ms) }}
                </span>
              </div>
              <ui-badge variant="secondary">{{ entry.entry_type }}</ui-badge>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">
              No audit entries. Run an exercise first.
            </p>
          }
        </ui-card>

        <ui-card title="Event Summary">
          @for (entry of eventEntries(); track entry.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span class="text-sm"
                >{{ entry.target_id }} — {{ entry.action }}</span
              >
              <span class="text-xs text-muted-foreground">
                {{ formatTime(entry.play_time_ms) }}
              </span>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">
              No event changes recorded.
            </p>
          }
        </ui-card>

        <ui-card title="Decision Analysis">
          @for (entry of decisionEntries(); track entry.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <div class="flex flex-col">
                <span class="text-sm">{{ entry.action }}</span>
                @if (entry.details && entry.details["title"]) {
                  <span class="text-xs text-muted-foreground">
                    {{ entry.details["title"] }}
                  </span>
                }
              </div>
              <span class="text-xs text-muted-foreground">
                {{ formatTime(entry.play_time_ms) }}
              </span>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">
              No decision entries recorded.
            </p>
          }
        </ui-card>
      </div>
    </div>
  `,
})
export class ReviewView implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly auditApi = inject(AuditApiService);

  protected readonly auditLog = signal<AuditEntry[]>([]);
  protected readonly replayIndex = signal(0);
  protected readonly playing = signal(false);
  protected readonly playbackSpeed = signal(1);
  private playTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly sortedLog = computed(() =>
    [...this.auditLog()].sort((a, b) => a.play_time_ms - b.play_time_ms),
  );

  protected readonly visibleEntries = computed(() =>
    this.sortedLog().slice(0, this.replayIndex()),
  );

  protected readonly currentEntry = computed(() => {
    const idx = this.replayIndex();
    const log = this.sortedLog();
    return idx > 0 ? log[idx - 1] : null;
  });

  protected readonly progressPercent = computed(() => {
    const total = this.sortedLog().length;
    return total === 0 ? 0 : (this.replayIndex() / total) * 100;
  });

  protected eventEntries = computed(() =>
    this.visibleEntries().filter((e) => e.entry_type === "event_change"),
  );

  protected decisionEntries = computed(() =>
    this.visibleEntries().filter((e) => e.entry_type === "decision"),
  );

  protected formatTime = formatTimeMs;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const exerciseId = Number(params["exerciseId"] ?? 1);
    this.auditApi.getLog(exerciseId).subscribe({
      next: (entries) => this.auditLog.set(entries),
    });
  }

  ngOnDestroy(): void {
    this.stopPlayback();
  }

  protected isHighlighted(entry: AuditEntry): boolean {
    const current = this.currentEntry();
    return current !== null && entry.id === current.id;
  }

  protected stepForward(): void {
    if (this.replayIndex() < this.sortedLog().length) {
      this.replayIndex.update((i) => i + 1);
    }
  }

  protected stepBack(): void {
    if (this.replayIndex() > 0) {
      this.replayIndex.update((i) => i - 1);
    }
  }

  protected resetReplay(): void {
    this.stopPlayback();
    this.replayIndex.set(0);
  }

  protected togglePlay(): void {
    if (this.playing()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  protected onSpeedChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const speed = parseFloat(target.value);
    this.playbackSpeed.set(speed);
    if (this.playing()) {
      this.stopPlayback();
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    this.playing.set(true);
    const interval = 1000 / this.playbackSpeed();
    this.playTimer = setInterval(() => {
      if (this.replayIndex() >= this.sortedLog().length) {
        this.stopPlayback();
        return;
      }
      this.stepForward();
    }, interval);
  }

  private stopPlayback(): void {
    this.playing.set(false);
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }
}
