import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { ButtonDirective, SidebarLayoutComponent } from "@aspect/ui";
import { DomainConfigApiService } from "../../core/domain-config-api.service";
import { FoundationStore } from "./foundation.store";
import { ScenarioSidebarNavComponent } from "../scenario-builder/scenario-sidebar-nav";
import type { SidebarSection } from "../scenario-builder/scenario-sidebar-nav";

@Component({
  selector: "tfc-foundation-view",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FoundationStore],
  imports: [
    RouterLink,
    ButtonDirective,
    SidebarLayoutComponent,
    ScenarioSidebarNavComponent,
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
            <h2 class="text-lg font-semibold">Roles</h2>
            <p class="text-muted-foreground text-sm">
              {{ config.roles.length }} roles defined. Editor coming in Task
              11b.
            </p>
          </section>

          <section
            id="section-systems"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <h2 class="text-lg font-semibold">Systems</h2>
            <p class="text-muted-foreground text-sm">
              {{ config.systems.length }} systems defined. Editor coming in Task
              11b.
            </p>
          </section>

          <section
            id="section-warfare-domains"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <h2 class="text-lg font-semibold">Warfare Domains</h2>
            <p class="text-muted-foreground text-sm">
              {{ config.warfare_domains.length }} warfare domains defined.
              Editor coming in Task 11b.
            </p>
          </section>

          <section
            id="section-blue-cards"
            style="scroll-margin-top: var(--spacing-xl)"
          >
            <h2 class="text-lg font-semibold">Blue Cards</h2>
            <p class="text-muted-foreground text-sm">
              {{ config.blue_card_catalog.length }} blue cards defined. Editor
              coming in Task 11b.
            </p>
          </section>
        }
      </div>
    </ui-sidebar-layout>
  `,
})
export class FoundationView implements OnInit {
  protected readonly store = inject(FoundationStore);
  private readonly api = inject(DomainConfigApiService);

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
