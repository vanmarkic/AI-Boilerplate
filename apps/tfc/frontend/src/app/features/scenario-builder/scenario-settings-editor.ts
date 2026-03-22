import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CardComponent } from "@aspect/ui";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-settings-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <ui-card title="Settings">
      <div class="flex flex-col gap-sm p-sm">
        <div class="flex items-center gap-sm">
          <span class="text-sm">Default Time Factor:</span>
          <input
            type="number"
            class="input-base"
            style="width: var(--container-xs, 5rem)"
            [value]="store.content().default_time_factor"
            (change)="onTimeFactorChange($event)"
          />
        </div>
        <div class="flex flex-col gap-xs">
          <span class="text-sm">Briefing:</span>
          <textarea
            class="input-base"
            rows="3"
            [value]="store.content().briefing ?? ''"
            (input)="onBriefingChange($event)"
          ></textarea>
        </div>
      </div>
    </ui-card>
  `,
})
export class ScenarioSettingsEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);

  protected onTimeFactorChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const val = parseFloat(target.value);
    if (val > 0) this.store.setTimeFactor(val);
  }

  protected onBriefingChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.setBriefing(target.value);
    }
  }
}
