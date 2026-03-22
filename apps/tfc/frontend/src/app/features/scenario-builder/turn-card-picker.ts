import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { BadgeComponent } from "@aspect/ui";
import type {
  TurnCardConfig,
} from "../../core/scenario-api.service";
import type { BlueCardDef } from "../../core/domain-config-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-turn-card-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, RouterLink],
  template: `
    <div class="flex flex-col gap-sm">
      <div class="flex items-center gap-sm">
        <label class="text-sm">Max selections:</label>
        <input
          type="number"
          class="input-base"
          style="width: 5rem"
          [value]="maxSelections()"
          (change)="updateMaxSelections($event)"
        />
      </div>

      @for (card of catalog(); track card.id) {
        <div class="flex flex-col gap-xs p-sm border-b">
          <div class="flex items-center gap-sm">
            <input
              type="checkbox"
              [checked]="isSelected(card.id)"
              (change)="toggleCard(card, $event)"
            />
            <ui-badge variant="secondary">{{ card.id }}</ui-badge>
            <span class="text-sm">{{ card.title }}</span>
            @if (card.targets_system) {
              <ui-badge variant="default">Targets system</ui-badge>
            }
          </div>

          @if (getConfig(card.id); as config) {
            <div class="flex items-center gap-sm ml-lg">
              <label class="text-xs">Score:</label>
              <input
                type="number"
                class="input-base"
                style="width: 5rem"
                [value]="config.score"
                (change)="updateScore(card.id, $event)"
              />
              <label class="text-xs">Stress delta:</label>
              <input
                type="number"
                class="input-base"
                style="width: 5rem"
                [value]="config.stress_delta"
                (change)="updateStressDelta(card.id, $event)"
              />
            </div>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm">
          No cards in catalog.
        </p>
      }

      <a routerLink="/foundation" class="text-sm text-muted-foreground">
        Card not in catalog? Edit Foundation &rarr;
      </a>
    </div>
  `,
})
export class TurnCardPickerComponent {
  private readonly store = inject(ScenarioBuilderStore);

  catalog = input.required<BlueCardDef[]>();
  selectedCards = input.required<TurnCardConfig[]>();
  turnIndex = input.required<number>();
  maxSelections = input(2);

  protected isSelected(cardId: string): boolean {
    return this.selectedCards().some((c) => c.card_id === cardId);
  }

  protected getConfig(cardId: string): TurnCardConfig | undefined {
    return this.selectedCards().find((c) => c.card_id === cardId);
  }

  protected toggleCard(card: BlueCardDef, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.checked) {
      this.store.addCardToTurn(this.turnIndex(), {
        card_id: card.id,
        score: 0,
        stress_delta: 0,
        system_effects: [],
        domain_effects: [],
        max_plays: 1,
      });
    } else {
      this.store.removeCardFromTurn(this.turnIndex(), card.id);
    }
  }

  protected updateScore(cardId: string, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateCardInTurn(this.turnIndex(), cardId, {
        score: +target.value,
      });
    }
  }

  protected updateStressDelta(cardId: string, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateCardInTurn(this.turnIndex(), cardId, {
        stress_delta: +target.value,
      });
    }
  }

  protected updateMaxSelections(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.store.updateTurn(this.turnIndex(), {
        max_selections: +target.value,
      });
    }
  }
}
