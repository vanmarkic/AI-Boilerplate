import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import type { TurnDefinition } from "../../core/scenario-api.service";
import {
  DomainConfigApiService,
  type BlueCardDef,
} from "../../core/domain-config-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { TurnTimelineComponent } from "./turn-timeline";
import { TurnEditorComponent } from "./turn-editor";

@Component({
  selector: "tfc-scenario-turns-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TurnTimelineComponent, TurnEditorComponent],
  template: `
    <div class="flex" style="height: 100%">
      <tfc-turn-timeline
        style="width: 14rem; border-right: 1px solid var(--color-border); overflow-y: auto; flex-shrink: 0"
        [turns]="store.content().turns ?? []"
        [selectedIndex]="selectedTurnIndex()"
        (onSelect)="selectedTurnIndex.set($event)"
        (onAdd)="addTurn()"
        (onDuplicate)="store.duplicateTurn($event)"
        (onDelete)="deleteTurn($event)"
      />
      <div style="flex: 1; overflow-y: auto; padding: var(--spacing-lg)">
        @if (selectedTurn(); as turn) {
          <tfc-turn-editor
            [turn]="turn"
            [turnIndex]="selectedTurnIndex()"
            [catalog]="catalog()"
            [roles]="roles()"
          />
        } @else {
          <p class="text-muted-foreground p-lg">
            Select or add a turn to begin editing.
          </p>
        }
      </div>
    </div>
  `,
})
export class ScenarioTurnsTabComponent implements OnInit {
  protected readonly store = inject(ScenarioBuilderStore);
  private readonly domainApi = inject(DomainConfigApiService);

  protected readonly selectedTurnIndex = signal(0);
  protected readonly catalog = signal<BlueCardDef[]>([]);
  protected readonly roles = signal<{ id: string; label: string }[]>([]);

  protected readonly selectedTurn = computed<TurnDefinition | null>(() => {
    const turns = this.store.content().turns ?? [];
    return turns.find((t) => t.turn_index === this.selectedTurnIndex()) ?? null;
  });

  ngOnInit(): void {
    this.domainApi.getBySlug("silent-wake").subscribe((config) => {
      this.catalog.set(config.blue_card_catalog);
      this.roles.set(config.roles);
    });

    const turns = this.store.content().turns ?? [];
    if (turns.length === 0) {
      this.store.addTurn({
        turn_index: 0,
        title: "Pre-Sail Briefing",
        has_decisions: false,
        facilitator_prompt: null,
        duration_ms: 900000,
        inject_ids: [],
        decision_template_id: null,
        injects: [],
        available_cards: [],
        max_selections: 2,
        base_stress_delta: 0,
        system_effects_on_start: [],
        domain_effects_on_start: [],
        best_path: null,
        acceptable_path: null,
        design_notes: "",
      });
    }
  }

  protected addTurn(): void {
    const turns = this.store.content().turns ?? [];
    const nextIndex = turns.length;
    this.store.addTurn({
      turn_index: nextIndex,
      title: "",
      has_decisions: true,
      facilitator_prompt: null,
      duration_ms: null,
      inject_ids: [],
      decision_template_id: null,
      injects: [],
      available_cards: [],
      max_selections: 2,
      base_stress_delta: 0,
      system_effects_on_start: [],
      domain_effects_on_start: [],
      best_path: null,
      acceptable_path: null,
      design_notes: "",
    });
    this.selectedTurnIndex.set(nextIndex);
  }

  protected deleteTurn(turnIndex: number): void {
    this.store.removeTurn(turnIndex);
    const turns = this.store.content().turns ?? [];
    if (turns.length === 0) {
      this.selectedTurnIndex.set(0);
    } else if (this.selectedTurnIndex() >= turns.length) {
      this.selectedTurnIndex.set(turns.length - 1);
    }
  }
}
