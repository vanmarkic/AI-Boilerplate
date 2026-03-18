import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CollapsiblePanelComponent } from '@aspect/ui';

@Component({
  selector: 'tfc-context-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollapsiblePanelComponent],
  host: { 'class': 'context-panel' },
  template: `
    <ui-collapsible-panel [open]="open()">
      <span panelTitle>{{ title() }}</span>

      @if (briefing()) {
        <div class="context-panel__section">
          <h4 class="context-panel__heading">Briefing</h4>
          <p class="context-panel__text">{{ briefing() }}</p>
        </div>
      }

      @if (objectives().length > 0) {
        <div class="context-panel__section">
          <h4 class="context-panel__heading">Objectives</h4>
          <ul class="context-panel__list">
            @for (obj of objectives(); track obj) {
              <li>{{ obj }}</li>
            }
          </ul>
        </div>
      }

      @if (rules().length > 0) {
        <div class="context-panel__section">
          <h4 class="context-panel__heading">Rules & Constraints</h4>
          <ul class="context-panel__list">
            @for (rule of rules(); track rule) {
              <li>{{ rule }}</li>
            }
          </ul>
        </div>
      }

      <ng-content />
    </ui-collapsible-panel>
  `,
})
export class ContextPanelComponent {
  readonly title = input<string>('Scenario Context');
  readonly briefing = input<string>('');
  readonly objectives = input<string[]>([]);
  readonly rules = input<string[]>([]);
  readonly open = input(false);
}
