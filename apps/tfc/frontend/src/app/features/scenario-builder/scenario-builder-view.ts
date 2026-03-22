import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import {
  ButtonDirective,
  CollapsiblePanelComponent,
  SidebarLayoutComponent,
} from "@aspect/ui";
import { ScenarioApiService } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { ScenarioBuilderActionsComponent } from "./scenario-builder-view-actions";
import { ScenarioSidebarNavComponent } from "./scenario-sidebar-nav";
import type { SidebarSection } from "./scenario-sidebar-nav";
import { ScenarioSetupTabComponent } from "./scenario-setup-tab";
import { validateScenarioContent } from "./validate-scenario-content";

@Component({
  selector: "tfc-scenario-builder-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ScenarioBuilderStore],
  imports: [
    ButtonDirective,
    CollapsiblePanelComponent,
    SidebarLayoutComponent,
    ScenarioBuilderActionsComponent,
    ScenarioSidebarNavComponent,
    ScenarioSetupTabComponent,
  ],
  template: `
    <ui-sidebar-layout
      side="left"
      style="--sidebar-width: 14rem; height: 100dvh"
    >
      <div
        sidebar
        class="flex flex-col gap-md p-sm"
        style="height: 100%; overflow-y: auto"
      >
        <tfc-scenario-sidebar-nav
          [sections]="sidebarSections()"
          [activeSection]="''"
        />
        <ui-collapsible-panel>
          <span panelTitle>Existing Scenarios</span>
          @for (s of scenarios(); track s.id) {
            <div class="flex items-center justify-between p-sm border-b">
              <span
                class="text-sm font-medium cursor-pointer"
                (click)="loadScenario(s.id)"
              >
                {{ s.title }}
              </span>
              <button
                uiButton
                variant="destructive"
                size="sm"
                (click)="deleteScenario(s.id)"
              >
                Delete
              </button>
            </div>
          } @empty {
            <p class="text-muted-foreground text-sm p-sm">
              No scenarios found.
            </p>
          }
        </ui-collapsible-panel>
      </div>

      <div class="flex flex-col gap-md p-lg" style="overflow-y: auto">
        <tfc-scenario-builder-actions
          [viewMode]="viewMode()"
          [isDirty]="isDirty()"
          (onSave)="save()"
          (onSaveAsCopy)="saveAsCopy()"
          (onToggleView)="
            viewMode.set(viewMode() === 'setup' ? 'turns' : 'setup')
          "
        />

        @if (store.error()) {
          <div
            class="p-sm border border-destructive bg-destructive/10 text-destructive text-sm rounded"
            role="alert"
          >
            <strong>Validation errors:</strong>
            <ul class="mt-xs ml-md list-disc">
              @for (err of store.error()!.split("\\n"); track err) {
                <li>{{ err }}</li>
              }
            </ul>
          </div>
        }

        @if (viewMode() === "setup") {
          <tfc-scenario-setup-tab />
        } @else {
          <p class="text-muted-foreground text-sm p-lg">
            Turns editor coming soon...
          </p>
        }
      </div>
    </ui-sidebar-layout>
  `,
})
export class ScenarioBuilderView implements OnInit {
  protected readonly store = inject(ScenarioBuilderStore);
  private readonly api = inject(ScenarioApiService);
  protected readonly scenarios = signal<{ id: number; title: string }[]>([]);

  protected readonly viewMode = signal<"setup" | "turns">("setup");

  protected readonly isDirty = computed(() => {
    const snap = this.store.loadedSnapshot();
    if (!snap) return false;
    const current = JSON.stringify({
      title: this.store.title(),
      description: this.store.description(),
      content: this.store.content(),
    });
    return current !== snap;
  });

  protected readonly sidebarSections = computed<SidebarSection[]>(() => [
    { id: "foundation", label: "Foundation", count: 0 },
    { id: "metadata", label: "Metadata", count: 0 },
    { id: "initial-states", label: "Initial States", count: 0 },
  ]);

  ngOnInit(): void {
    this.loadList();
  }

  private loadList(): void {
    this.api.list().subscribe({
      next: (list) =>
        this.scenarios.set(list.map((s) => ({ id: s.id, title: s.title }))),
    });
  }

  protected loadScenario(id: number): void {
    this.api.get(id).subscribe({
      next: (s) =>
        this.store.loadScenario(s.id, s.title, s.description, s.content),
    });
  }

  protected save(): void {
    this.store.clearError();
    const content = this.store.content();
    const errors = validateScenarioContent(content);
    if (!this.store.title().trim()) errors.unshift("Title is required.");
    if (errors.length > 0) {
      this.store.setError(errors.join("\n"));
      return;
    }
    this.store.setSaving(true);
    const payload = {
      title: this.store.title(),
      description: this.store.description(),
      content,
    };
    const id = this.store.scenarioId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () =>
        this.store.setError("Save failed — server rejected the scenario."),
    });
  }

  protected saveAsCopy(): void {
    const id = this.store.scenarioId();
    if (!id) return;
    this.store.setSaving(true);
    this.api.clone(id).subscribe({
      next: (s) => {
        this.store.loadScenario(s.id, s.title, s.description, s.content);
        this.store.setSaving(false);
        this.loadList();
      },
      error: () => {
        this.store.setSaving(false);
        this.store.setError("Clone failed.");
      },
    });
  }

  protected deleteScenario(id: number): void {
    this.api.delete(id).subscribe({ next: () => this.loadList() });
  }
}
