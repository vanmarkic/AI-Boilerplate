import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { ButtonDirective, BadgeComponent } from "@aspect/ui";
import type { TurnDefinition } from "../../core/scenario-api.service";

@Component({
  selector: "tfc-turn-timeline",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, BadgeComponent],
  template: `
    <div class="flex flex-col gap-xs p-sm" style="height: 100%">
      <h3 class="text-sm font-medium p-xs">Turns</h3>

      <div class="flex flex-col gap-xs" style="flex: 1; overflow-y: auto">
        @for (turn of turns(); track turn.turn_index) {
          <div
            class="flex items-center gap-xs p-sm rounded cursor-pointer"
            [style.background]="
              turn.turn_index === selectedIndex()
                ? 'var(--color-muted)'
                : 'transparent'
            "
            (click)="onSelect.emit(turn.turn_index)"
          >
            <span
              class="stress-pip"
              [style.background]="stressColor(turn.base_stress_delta)"
            ></span>
            <ui-badge variant="secondary">{{ turn.turn_index }}</ui-badge>
            <span
              class="text-sm"
              style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
            >
              {{
                turn.title
                  ? truncate(turn.title, 20)
                  : "Turn " + turn.turn_index
              }}
            </span>
            <div class="flex gap-xs">
              <button
                uiButton
                variant="outline"
                size="sm"
                (click)="
                  onDuplicate.emit(turn.turn_index); $event.stopPropagation()
                "
              >
                Dup
              </button>
              <button
                uiButton
                variant="destructive"
                size="sm"
                (click)="
                  onDelete.emit(turn.turn_index); $event.stopPropagation()
                "
              >
                Del
              </button>
            </div>
          </div>
        } @empty {
          <p class="text-muted-foreground text-sm p-sm">No turns yet.</p>
        }
      </div>

      <button
        uiButton
        variant="outline"
        size="sm"
        style="width: 100%"
        (click)="onAdd.emit()"
      >
        + Add Turn
      </button>
    </div>
  `,
  styles: `
    .stress-pip {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `,
})
export class TurnTimelineComponent {
  turns = input.required<TurnDefinition[]>();
  selectedIndex = input<number>(0);
  onSelect = output<number>();
  onAdd = output<void>();
  onDuplicate = output<number>();
  onDelete = output<number>();

  protected truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  protected stressColor(delta: number): string {
    if (delta > 0) return "var(--color-warning, orange)";
    if (delta < 0) return "var(--color-info, dodgerblue)";
    return "var(--color-success, green)";
  }
}
