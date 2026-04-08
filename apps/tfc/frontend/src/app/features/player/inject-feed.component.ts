import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import type { EventSnapshot } from "../../core/generated/state-changes.types";
import { formatTimeMs } from "../../core/format-time";

@Component({
  selector: "tfc-inject-feed",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visibleEvents().length === 0) {
      <div class="inject-feed__empty">No injects yet...</div>
    } @else {
      <ul class="inject-feed__list">
        @for (event of visibleEvents(); track event.id) {
          <li
            class="inject-feed__item"
            [class.inject-feed__item--active]="event.lifecycle === 'running'"
            [class.inject-feed__item--completed]="event.lifecycle === 'completed'"
          >
            <span class="inject-feed__time">{{
              formatTimeMs(event.scheduled_pt_ms)
            }}</span>
            <div class="inject-feed__content">
              <span class="inject-feed__title">{{ event.title }}</span>
              <p class="inject-feed__desc">{{ resolveDescription(event) }}</p>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class InjectFeedComponent {
  readonly events = input<EventSnapshot[]>([]);
  readonly playerRole = input<string>("");

  protected readonly visibleEvents = computed(() => {
    const all = this.events();
    return all
      .filter(
        (e) => e.lifecycle === "running" || e.lifecycle === "completed",
      )
      .sort((a, b) => {
        const aTime = a.started_at_pt_ms ?? a.scheduled_pt_ms;
        const bTime = b.started_at_pt_ms ?? b.scheduled_pt_ms;
        return bTime - aTime;
      });
  });

  protected readonly formatTimeMs = formatTimeMs;

  protected resolveDescription(event: EventSnapshot): string {
    const role = this.playerRole();
    if (
      role &&
      event.target_roles.length > 0 &&
      event.role_descriptions[role]
    ) {
      return event.role_descriptions[role];
    }
    return event.description;
  }
}
