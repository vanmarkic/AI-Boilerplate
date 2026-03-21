import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { CardComponent, ButtonDirective, BadgeComponent } from "@aspect/ui";
import { formatTimeMs } from "../../core/format-time";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-walkthrough",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, BadgeComponent],
  template: `
    @if (sortedEvents().length === 0) {
      <div class="flex items-center justify-center p-2xl">
        <p class="text-muted-foreground">No events to walk through.</p>
      </div>
    } @else {
      <div class="flex flex-col items-center gap-lg p-lg" style="max-width: 40rem; margin: 0 auto">
        @let event = sortedEvents()[safeIndex()];
        <ui-card [title]="event.title" style="width: 100%">
          <div class="flex flex-col gap-sm p-sm">
            <div class="flex gap-sm items-center">
              <ui-badge variant="secondary">{{ event.event_type }}</ui-badge>
              <span class="text-sm text-muted-foreground">{{ formatTime(event.scheduled_pt_ms) }}</span>
              @if (event.duration_ms) {
                <span class="text-xs text-muted-foreground">duration: {{ formatTime(event.duration_ms) }}</span>
              }
            </div>
            @if (event.description) {
              <p class="text-sm">{{ event.description }}</p>
            }
            @if (event.target_roles.length > 0) {
              <div class="flex gap-xs items-center">
                <span class="text-xs text-muted-foreground">Roles:</span>
                @for (role of event.target_roles; track role) {
                  <ui-badge variant="outline">{{ role }}</ui-badge>
                }
              </div>
            }
            @if (event.triggered_issues.length > 0) {
              <div class="flex gap-xs items-center">
                <span class="text-xs text-muted-foreground">Triggers:</span>
                @for (issueId of event.triggered_issues; track issueId) {
                  <ui-badge variant="outline">{{ issueId }}</ui-badge>
                }
              </div>
            }
          </div>
        </ui-card>

        <div class="flex items-center gap-md">
          <button
            uiButton
            variant="outline"
            [disabled]="safeIndex() === 0"
            (click)="currentIndex.set(safeIndex() - 1)"
          >Previous</button>
          <span class="text-sm text-muted-foreground">
            Event {{ safeIndex() + 1 }} of {{ sortedEvents().length }}
            — {{ formatTime(event.scheduled_pt_ms) }}
          </span>
          <button
            uiButton
            variant="outline"
            [disabled]="safeIndex() >= sortedEvents().length - 1"
            (click)="currentIndex.set(safeIndex() + 1)"
          >Next</button>
        </div>
      </div>
    }
  `,
})
export class ScenarioWalkthroughComponent {
  private readonly store = inject(ScenarioBuilderStore);

  protected readonly sortedEvents = computed(() =>
    [...this.store.content().events].sort(
      (a, b) => a.scheduled_pt_ms - b.scheduled_pt_ms,
    ),
  );

  protected readonly currentIndex = signal(0);

  protected readonly safeIndex = computed(() => {
    const len = this.sortedEvents().length;
    if (len === 0) return 0;
    return Math.min(this.currentIndex(), len - 1);
  });

  protected formatTime(ms: number): string {
    return formatTimeMs(ms);
  }
}
