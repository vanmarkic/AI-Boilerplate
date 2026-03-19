import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { ButtonDirective } from "@aspect/ui";

@Component({
  selector: "tfc-briefing-overlay",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  host: { class: "briefing-overlay" },
  template: `
    <div class="briefing-overlay__backdrop"></div>
    <div class="briefing-overlay__panel">
      <header class="briefing-overlay__header">
        <h1 class="briefing-overlay__title">{{ title() }}</h1>
      </header>

      <div class="briefing-overlay__body">
        @if (briefing()) {
          <section class="briefing-overlay__section">
            <h2 class="briefing-overlay__heading">Briefing</h2>
            <p class="briefing-overlay__text">{{ briefing() }}</p>
          </section>
        }

        @if (objectives().length > 0) {
          <section class="briefing-overlay__section">
            <h2 class="briefing-overlay__heading">Objectives</h2>
            <ul class="briefing-overlay__list">
              @for (obj of objectives(); track obj) {
                <li>{{ obj }}</li>
              }
            </ul>
          </section>
        }

        @if (roles().length > 0) {
          <section class="briefing-overlay__section">
            <h2 class="briefing-overlay__heading">Roles</h2>
            <div class="briefing-overlay__roles">
              @for (role of roles(); track role.id) {
                <span class="briefing-overlay__role">
                  {{ role.label }}
                  <span class="briefing-overlay__role-type">{{ role.player_type }}</span>
                </span>
              }
            </div>
          </section>
        }
      </div>

      <footer class="briefing-overlay__footer">
        <button
          uiButton
          variant="default"
          size="lg"
          [disabled]="starting()"
          (click)="begun.emit()"
        >
          {{ starting() ? 'Starting...' : 'Begin Exercise' }}
        </button>
      </footer>
    </div>
  `,
})
export class BriefingOverlayComponent {
  readonly title = input("");
  readonly briefing = input("");
  readonly objectives = input<string[]>([]);
  readonly roles = input<{ id: string; label: string; player_type: string }[]>(
    [],
  );
  readonly starting = input(false);
  readonly begun = output();
}
