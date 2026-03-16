import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent, CardComponent } from '@aspect/ui';

@Component({
  selector: 'tfc-scenario-builder-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CardComponent],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <ui-page-header
        title="Scenario Builder"
        subtitle="Coming Soon"
      />

      <div class="grid grid-cols-2 gap-md">
        <ui-card title="Phases">
          <p class="text-muted-foreground text-sm">
            Define exercise phases with timing, objectives, and transition
            criteria.
          </p>
        </ui-card>

        <ui-card title="Events">
          <p class="text-muted-foreground text-sm">
            Create and schedule events that will be injected during the
            exercise timeline.
          </p>
        </ui-card>

        <ui-card title="Issues">
          <p class="text-muted-foreground text-sm">
            Configure issues that are generated from events and require
            player decisions.
          </p>
        </ui-card>

        <ui-card title="Decisions">
          <p class="text-muted-foreground text-sm">
            Define decision templates with options, scoring criteria, and
            expected outcomes.
          </p>
        </ui-card>
      </div>
    </div>
  `,
})
export class ScenarioBuilderView {}
