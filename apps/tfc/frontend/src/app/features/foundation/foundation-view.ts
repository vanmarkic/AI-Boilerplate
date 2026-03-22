import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { ButtonDirective, SidebarLayoutComponent } from "@aspect/ui";
import {
  DomainConfigApiService,
  type DomainRole,
  type SystemDef,
  type WarfareDomainDef,
  type BlueCardDef,
} from "../../core/domain-config-api.service";
import { FoundationStore } from "./foundation.store";
import { ScenarioSidebarNavComponent } from "../scenario-builder/scenario-sidebar-nav";
import type { SidebarSection } from "../scenario-builder/scenario-sidebar-nav";
import {
  FoundationCatalogSectionComponent,
  type FieldDef,
} from "./foundation-catalog-section";

@Component({
  selector: "tfc-foundation-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FoundationStore],
  imports: [
    RouterLink,
    ButtonDirective,
    SidebarLayoutComponent,
    ScenarioSidebarNavComponent,
    FoundationCatalogSectionComponent,
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
        <a routerLink="/home" class="text-sm text-muted-foreground p-xs">
          &larr; Back to Home
        </a>
        <tfc-scenario-sidebar-nav
          [sections]="sidebarSections()"
          [activeSection]="''"
        />
      </div>

      <div class="flex flex-col gap-md p-lg" style="overflow-y: auto">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold">
            Foundation &mdash; {{ configName() }}
          </h1>
          <button
            uiButton
            variant="default"
            [disabled]="store.saving()"
            (click)="save()"
          >
            {{ store.saving() ? "Saving\u2026" : "Save" }}
          </button>
        </div>

        @if (store.error()) {
          <div
            class="p-sm border border-destructive bg-destructive/10 text-destructive text-sm rounded"
            role="alert"
          >
            {{ store.error() }}
          </div>
        }

        @if (store.loading()) {
          <p class="text-muted-foreground">Loading configuration&hellip;</p>
        }

        @if (store.config(); as config) {
          <section
            id="section-roles"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <tfc-foundation-catalog-section
              title="Roles"
              sectionId="roles"
              [items]="asRecords(config.roles)"
              [fields]="roleFields"
              idField="id"
              labelField="label"
              (onAdd)="addRole($event)"
              (onUpdate)="updateRole($event)"
              (onRemove)="store.removeRole($event)"
            />
          </section>

          <section
            id="section-systems"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <tfc-foundation-catalog-section
              title="Systems"
              sectionId="systems"
              [items]="asRecords(config.systems)"
              [fields]="systemFields"
              idField="id"
              labelField="label"
              (onAdd)="addSystem($event)"
              (onUpdate)="updateSystem($event)"
              (onRemove)="store.removeSystem($event)"
            />
          </section>

          <section
            id="section-warfare-domains"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <tfc-foundation-catalog-section
              title="Warfare Domains"
              sectionId="warfare-domains"
              [items]="asRecords(config.warfare_domains)"
              [fields]="warfareDomainFields"
              idField="id"
              labelField="label"
              (onAdd)="addWarfareDomain($event)"
              (onUpdate)="updateWarfareDomain($event)"
              (onRemove)="store.removeWarfareDomain($event)"
            />
          </section>

          <section
            id="section-blue-cards"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <tfc-foundation-catalog-section
              title="Blue Cards"
              sectionId="blue-cards"
              [items]="asRecords(config.blue_card_catalog)"
              [fields]="blueCardFields"
              idField="id"
              labelField="title"
              (onAdd)="addBlueCard($event)"
              (onUpdate)="updateBlueCard($event)"
              (onRemove)="store.removeBlueCard($event)"
            />
          </section>
        }
      </div>
    </ui-sidebar-layout>
  `,
})
export class FoundationView implements OnInit {
  protected readonly store = inject(FoundationStore);
  private readonly api = inject(DomainConfigApiService);

  readonly roleFields: FieldDef[] = [
    { key: "id", label: "ID", type: "text", readOnlyAfterCreate: true },
    { key: "label", label: "Label", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
  ];

  readonly systemFields: FieldDef[] = [
    { key: "id", label: "ID", type: "text", readOnlyAfterCreate: true },
    { key: "label", label: "Label", type: "text" },
    {
      key: "category",
      label: "Category",
      type: "select",
      options: ["system", "weapon"],
    },
    { key: "description", label: "Description", type: "textarea" },
  ];

  readonly warfareDomainFields: FieldDef[] = [
    { key: "id", label: "ID", type: "text", readOnlyAfterCreate: true },
    { key: "label", label: "Label", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
  ];

  readonly blueCardFields: FieldDef[] = [
    { key: "id", label: "ID", type: "text", readOnlyAfterCreate: true },
    { key: "title", label: "Title", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "targets_system", label: "Targets System", type: "checkbox" },
  ];

  /** Spread each item so TS sees a fresh Record<string, unknown> type. */
  protected asRecords(items: object[]): Record<string, unknown>[] {
    return items.map((item) => ({ ...item }));
  }

  protected readonly configName = computed(
    () => this.store.config()?.name ?? "",
  );

  protected readonly sidebarSections = computed<SidebarSection[]>(() => {
    const c = this.store.config();
    if (!c) return [];
    return [
      { id: "roles", label: "Roles", count: c.roles.length },
      { id: "systems", label: "Systems", count: c.systems.length },
      {
        id: "warfare-domains",
        label: "Warfare Domains",
        count: c.warfare_domains.length,
      },
      {
        id: "blue-cards",
        label: "Blue Cards",
        count: c.blue_card_catalog.length,
      },
    ];
  });

  ngOnInit(): void {
    this.loadBySlug("silent-wake");
  }

  private loadBySlug(slug: string): void {
    this.store.setLoading(true);
    this.api.getBySlug(slug).subscribe({
      next: (config) => this.store.setConfig(config),
      error: () => this.store.setError("Failed to load domain configuration."),
    });
  }

  // ── Catalog adapters (Record<string,unknown> → typed store calls) ──

  protected addRole(r: Record<string, unknown>): void {
    this.store.addRole({
      id: String(r["id"] ?? ""),
      label: String(r["label"] ?? ""),
      description: String(r["description"] ?? ""),
    });
  }

  protected updateRole(e: {
    id: string;
    updates: Record<string, unknown>;
  }): void {
    const u = e.updates;
    this.store.updateRole(e.id, {
      id: String(u["id"] ?? ""),
      label: String(u["label"] ?? ""),
      description: String(u["description"] ?? ""),
    } satisfies Partial<DomainRole>);
  }

  protected addSystem(r: Record<string, unknown>): void {
    this.store.addSystem({
      id: String(r["id"] ?? ""),
      label: String(r["label"] ?? ""),
      category: String(r["category"] ?? "system"),
      description: String(r["description"] ?? ""),
    });
  }

  protected updateSystem(e: {
    id: string;
    updates: Record<string, unknown>;
  }): void {
    const u = e.updates;
    this.store.updateSystem(e.id, {
      id: String(u["id"] ?? ""),
      label: String(u["label"] ?? ""),
      category: String(u["category"] ?? "system"),
      description: String(u["description"] ?? ""),
    } satisfies Partial<SystemDef>);
  }

  protected addWarfareDomain(r: Record<string, unknown>): void {
    this.store.addWarfareDomain({
      id: String(r["id"] ?? ""),
      label: String(r["label"] ?? ""),
      description: String(r["description"] ?? ""),
    });
  }

  protected updateWarfareDomain(e: {
    id: string;
    updates: Record<string, unknown>;
  }): void {
    const u = e.updates;
    this.store.updateWarfareDomain(e.id, {
      id: String(u["id"] ?? ""),
      label: String(u["label"] ?? ""),
      description: String(u["description"] ?? ""),
    } satisfies Partial<WarfareDomainDef>);
  }

  protected addBlueCard(r: Record<string, unknown>): void {
    this.store.addBlueCard({
      id: String(r["id"] ?? ""),
      title: String(r["title"] ?? ""),
      description: String(r["description"] ?? ""),
      targets_system: Boolean(r["targets_system"]),
    });
  }

  protected updateBlueCard(e: {
    id: string;
    updates: Record<string, unknown>;
  }): void {
    const u = e.updates;
    this.store.updateBlueCard(e.id, {
      id: String(u["id"] ?? ""),
      title: String(u["title"] ?? ""),
      description: String(u["description"] ?? ""),
      targets_system: Boolean(u["targets_system"]),
    } satisfies Partial<BlueCardDef>);
  }

  protected save(): void {
    const config = this.store.config();
    if (!config) return;
    this.store.clearError();
    this.store.setSaving(true);
    this.api
      .update(config.id, {
        roles: config.roles,
        systems: config.systems,
        warfare_domains: config.warfare_domains,
        blue_card_catalog: config.blue_card_catalog,
      })
      .subscribe({
        next: (updated) => {
          this.store.setConfig(updated);
          this.store.setSaving(false);
        },
        error: () =>
          this.store.setError(
            "Save failed \u2014 server rejected the configuration.",
          ),
      });
  }
}
