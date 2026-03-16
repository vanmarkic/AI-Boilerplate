import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent, CardComponent } from '@aspect/ui';

@Component({
  selector: 'tfc-review-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CardComponent],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <ui-page-header
        title="Exercise Review"
        subtitle="Coming Soon"
      />

      <div class="grid grid-cols-3 gap-md">
        <ui-card title="Timeline Replay">
          <p class="text-muted-foreground text-sm">
            Replay the full exercise timeline with events, issues, and
            decisions displayed chronologically.
          </p>
        </ui-card>

        <ui-card title="Scoring">
          <p class="text-muted-foreground text-sm">
            View aggregated scores by player, team, and phase. Compare
            performance against expected outcomes.
          </p>
        </ui-card>

        <ui-card title="Decision Analysis">
          <p class="text-muted-foreground text-sm">
            Analyze individual decisions with timing, rationale, and
            impact assessment for after-action review.
          </p>
        </ui-card>
      </div>
    </div>
  `,
})
export class ReviewView {}
