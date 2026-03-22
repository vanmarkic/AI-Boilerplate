import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import {
  ButtonDirective,
  InputComponent,
  CollapsiblePanelComponent,
} from "@aspect/ui";
import type { DomainConfigResponse } from "../../core/domain-config-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { exportScenarioToJson, parseScenarioImport } from "./scenario-export";

@Component({
  selector: "tfc-scenario-builder-actions",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, InputComponent, CollapsiblePanelComponent],
  template: `
    <div class="flex flex-col gap-sm">
      <div class="flex items-center gap-sm flex-wrap">
        <ui-input
          id="scenario-title"
          label=""
          placeholder="Scenario title"
          [value]="store.title()"
          (valueChange)="store.setTitle($event)"
          style="flex: 1; min-width: 12rem"
        />
        <button uiButton (click)="onSave.emit()">
          {{ store.scenarioId() ? "Update" : "Create" }}
        </button>
        @if (store.scenarioId()) {
          <button uiButton variant="outline" (click)="onSaveAsCopy.emit()">
            Save as Copy
          </button>
          <button uiButton variant="outline" (click)="store.reset()">
            New
          </button>
        }
        <button uiButton variant="outline" (click)="exportJson()">
          Export
        </button>
        <button uiButton variant="outline" (click)="triggerFileInput()">
          Import
        </button>
        @if (isDirty()) {
          <button uiButton variant="outline" (click)="store.revert()">
            Revert
          </button>
        }
        <button uiButton variant="outline" (click)="onToggleView.emit()">
          {{ viewMode() === "setup" ? "Turns" : "Setup" }}
        </button>
      </div>

      <ui-collapsible-panel>
        <span panelTitle>Description</span>
        <ui-input
          id="scenario-desc"
          label=""
          placeholder="Description"
          [value]="store.description()"
          (valueChange)="store.setDescription($event)"
        />
      </ui-collapsible-panel>

      <input
        #fileInput
        type="file"
        accept=".json"
        style="display: none"
        (change)="onFileSelected($event)"
      />
    </div>
  `,
})
export class ScenarioBuilderActionsComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  protected readonly fileInput =
    viewChild<ElementRef<HTMLInputElement>>("fileInput");

  readonly viewMode = input.required<"setup" | "turns">();
  readonly isDirty = input(false);
  readonly domainConfig = input<DomainConfigResponse | null>(null);

  readonly onSave = output<void>();
  readonly onSaveAsCopy = output<void>();
  readonly onToggleView = output<void>();

  protected triggerFileInput(): void {
    this.fileInput()?.nativeElement?.click();
  }

  protected exportJson(): void {
    const title = this.store.title() || "scenario";
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const blob = exportScenarioToJson(
      this.store.title(),
      this.store.description(),
      this.store.content(),
      this.domainConfig() ?? undefined,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const result = parseScenarioImport(text);
      if (!result) {
        this.store.setError("Invalid scenario JSON file.");
        return;
      }
      this.store.loadImport(result.title, result.description, result.content);
    });
    input.value = "";
  }
}
