import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { CardComponent, BadgeComponent } from "@aspect/ui";
import type { TurnDefinition } from "../../core/scenario-api.service";
import type { BlueCardDef } from "../../core/domain-config-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { TurnInjectEditorComponent } from "./turn-inject-editor";
import { TurnCardPickerComponent } from "./turn-card-picker";

@Component({
  selector: "tfc-turn-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    BadgeComponent,
    TurnInjectEditorComponent,
    TurnCardPickerComponent,
  ],
  template: `
    <div class="flex flex-col gap-md">
      <!-- Section 1: Turn Header -->
      <ui-card title="Turn Header">
        <div class="flex flex-col gap-sm">
          <div class="flex items-center gap-sm">
            <ui-badge variant="secondary">Turn {{ turnIndex() }}</ui-badge>
          </div>
          <input
            class="input-base"
            placeholder="Turn title"
            [value]="turn().title"
            (change)="updateTitle($event)"
          />
          <textarea
            class="input-base"
            rows="3"
            placeholder="Facilitator prompt..."
            [value]="turn().facilitator_prompt ?? ''"
            (input)="updatePrompt($event)"
          ></textarea>
          <label class="flex items-center gap-xs text-sm">
            <input
              type="checkbox"
              [checked]="turn().has_decisions"
              (change)="toggleDecisions($event)"
            />
            Has decisions
          </label>
          @if (!turn().has_decisions) {
            <input
              type="number"
              class="input-base"
              placeholder="Duration (ms)"
              [value]="turn().duration_ms ?? ''"
              (change)="updateDuration($event)"
            />
          }
        </div>
      </ui-card>

      <!-- Section 2: Injects -->
      <ui-card title="Injects">
        <tfc-turn-inject-editor
          [injects]="turn().injects"
          [roles]="roles()"
          [turnIndex]="turnIndex()"
        />
      </ui-card>

      <!-- Section 3: Blue Cards -->
      @if (turn().has_decisions) {
        <ui-card title="Blue Cards">
          <tfc-turn-card-picker
            [catalog]="catalog()"
            [selectedCards]="turn().available_cards"
            [turnIndex]="turnIndex()"
            [maxSelections]="turn().max_selections"
          />
        </ui-card>
      }

      <!-- Section 4: Turn Consequences -->
      <ui-card title="Turn Consequences">
        <div class="flex items-center gap-sm">
          <span class="text-sm">Base stress delta:</span>
          <input
            type="number"
            class="input-base"
            style="width: 5rem"
            [value]="turn().base_stress_delta"
            (change)="updateStressDelta($event)"
          />
        </div>
      </ui-card>

      <!-- Section 5: Facilitator Notes -->
      <ui-card title="Facilitator Notes">
        <div class="flex flex-col gap-sm">
          <textarea
            class="input-base"
            rows="2"
            placeholder="Best path notes..."
            [value]="turn().best_path?.notes ?? ''"
            (input)="updateBestPathNotes($event)"
          ></textarea>
          <textarea
            class="input-base"
            rows="2"
            placeholder="Acceptable path notes..."
            [value]="turn().acceptable_path?.notes ?? ''"
            (input)="updateAcceptablePathNotes($event)"
          ></textarea>
          <textarea
            class="input-base"
            rows="2"
            placeholder="Design notes..."
            [value]="turn().design_notes"
            (input)="updateDesignNotes($event)"
          ></textarea>
        </div>
      </ui-card>
    </div>
  `,
})
export class TurnEditorComponent {
  private readonly store = inject(ScenarioBuilderStore);

  turn = input.required<TurnDefinition>();
  turnIndex = input.required<number>();
  catalog = input.required<BlueCardDef[]>();
  roles = input.required<{ id: string; label: string }[]>();

  protected updateTitle(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateTurn(this.turnIndex(), { title: target.value });
    }
  }

  protected updatePrompt(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.updateTurn(this.turnIndex(), {
        facilitator_prompt: target.value || null,
      });
    }
  }

  protected toggleDecisions(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateTurn(this.turnIndex(), {
        has_decisions: target.checked,
      });
    }
  }

  protected updateDuration(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      const val = target.value ? +target.value : null;
      this.store.updateTurn(this.turnIndex(), { duration_ms: val });
    }
  }

  protected updateStressDelta(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateTurn(this.turnIndex(), {
        base_stress_delta: +target.value,
      });
    }
  }

  protected updateBestPathNotes(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      const current = this.turn().best_path ?? { card_ids: [], notes: "" };
      this.store.updateTurn(this.turnIndex(), {
        best_path: { ...current, notes: target.value },
      });
    }
  }

  protected updateAcceptablePathNotes(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      const current = this.turn().acceptable_path ?? {
        card_ids: [],
        notes: "",
      };
      this.store.updateTurn(this.turnIndex(), {
        acceptable_path: { ...current, notes: target.value },
      });
    }
  }

  protected updateDesignNotes(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.updateTurn(this.turnIndex(), {
        design_notes: target.value,
      });
    }
  }
}
