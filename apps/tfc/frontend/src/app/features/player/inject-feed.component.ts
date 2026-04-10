import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent } from '@aspect/ui';
import { formatTimeMs } from '../../core/format-time';
import type { InjectSnapshot } from '../../core/engine-api.service';

@Component({
  selector: 'tfc-inject-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="inject-feed">
      @for (inject of releasedInjects(); track inject.id) {
        <div class="inject-feed__item"
          [class.inject-feed__item--running]="inject.lifecycle === 'running'"
          [class.inject-feed__item--completed]="inject.lifecycle === 'completed' || inject.lifecycle === 'paused'">
          <div class="inject-feed__item-header">
            <span class="inject-feed__timestamp text-xs text-muted-foreground">
              {{ formatTs(inject.started_at_pt_ms) }}
            </span>
            <ui-badge variant="secondary">{{ inject.inject_type }}</ui-badge>
            @if (inject.lifecycle === 'running') {
              <ui-badge variant="default">live</ui-badge>
            }
          </div>
          <p class="inject-feed__title text-sm font-medium">{{ inject.title }}</p>
          <p class="inject-feed__description text-sm text-muted-foreground">
            {{ roleDescription(inject) }}
          </p>
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm p-sm">No injects released yet.</p>
      }
    </div>
  `,
})
export class InjectFeedComponent {
  readonly injects = input.required<InjectSnapshot[]>();
  readonly playTimeMs = input.required<number>();
  readonly playerRole = input<string>('');

  protected readonly releasedInjects = computed(() =>
    this.injects()
      .filter((i) => i.lifecycle === 'running' || i.lifecycle === 'completed' || i.lifecycle === 'paused')
      .slice()
      .sort((a, b) => (b.started_at_pt_ms ?? 0) - (a.started_at_pt_ms ?? 0)),
  );

  protected formatTs(ms: number | null): string {
    return ms != null ? formatTimeMs(ms) : '--:--:--';
  }

  protected roleDescription(inject: InjectSnapshot): string {
    const role = this.playerRole();
    if (role && inject.role_descriptions?.[role]) {
      return inject.role_descriptions[role];
    }
    return inject.description;
  }
}
