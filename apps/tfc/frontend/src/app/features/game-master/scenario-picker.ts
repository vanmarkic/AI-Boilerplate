import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { CardComponent, ButtonDirective, BadgeComponent } from '@aspect/ui';
import { DomainService } from '../../core/domain.service';
import { ScenarioApiService } from '../../core/scenario-api.service';
import type { ScenarioResponse } from '../../core/scenario-api.service';

@Component({
  selector: 'tfc-scenario-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, BadgeComponent],
  template: `
    <div class="flex flex-col gap-md p-lg">
      <h2 class="text-lg font-semibold">Select a {{ domain.term('exercise') }}</h2>
      <p class="text-sm text-muted-foreground">
        Pick a scenario created in the Builder to start an exercise.
      </p>

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading scenarios…</p>
      } @else if (error()) {
        <p class="text-sm text-destructive">{{ error() }}</p>
        <button uiButton variant="outline" size="sm" (click)="load()">Retry</button>
      } @else {
        <div class="grid grid-cols-1 gap-sm">
          @for (scenario of scenarios(); track scenario.id) {
            <ui-card [title]="scenario.title">
              <div class="flex items-center justify-between p-sm">
                <div class="flex flex-col gap-xs">
                  <span class="text-sm text-muted-foreground">{{ scenario.description || 'No description' }}</span>
                  <div class="flex gap-xs">
                    <ui-badge variant="secondary">
                      {{ scenario.content?.events?.length ?? 0 }} {{ domain.term('event') }}s
                    </ui-badge>
                    <ui-badge variant="secondary">
                      {{ scenario.content?.issues?.length ?? 0 }} {{ domain.term('issue') }}s
                    </ui-badge>
                    <ui-badge variant="secondary">
                      v{{ scenario.version }}
                    </ui-badge>
                  </div>
                </div>
                <button uiButton variant="default" (click)="pick(scenario)">
                  Select
                </button>
              </div>
            </ui-card>
          } @empty {
            <p class="text-muted-foreground text-sm">
              No scenarios found. Create one in the
              <a href="/builder" class="text-primary underline">Scenario Builder</a>.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class ScenarioPickerComponent implements OnInit {
  readonly scenarioSelected = output<ScenarioResponse>();

  protected readonly domain = inject(DomainService);
  private readonly api = inject(ScenarioApiService);
  protected readonly scenarios = signal<ScenarioResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (list) => {
        this.scenarios.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load scenarios');
        this.loading.set(false);
      },
    });
  }

  protected pick(scenario: ScenarioResponse): void {
    this.scenarioSelected.emit(scenario);
  }
}
