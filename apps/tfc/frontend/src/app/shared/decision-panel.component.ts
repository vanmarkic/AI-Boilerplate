import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  inject,
  ElementRef,
  AfterViewInit,
} from "@angular/core";
import { DialogPanelComponent, ButtonComponent } from "@aspect/ui";
import { AnimationService } from "../core/animation.service";

export interface DecisionOption {
  id: string;
  label: string;
}

@Component({
  selector: "tfc-decision-panel",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogPanelComponent, ButtonComponent],
  template: `
    <ui-dialog-panel (closed)="closed.emit()">
      <span dialogTitle>{{ title() }}</span>

      @if (description()) {
        <p class="decision-panel__description">{{ description() }}</p>
      }

      <div class="decision-panel__options">
        @if (questionType() === "single_choice") {
          @for (option of options(); track option.id) {
            <label
              class="decision-panel__option"
              [class.decision-panel__option--selected]="
                selectedOptions()[0] === option.id
              "
            >
              <input
                type="radio"
                [name]="'decision-' + title()"
                [value]="option.id"
                [checked]="selectedOptions()[0] === option.id"
                (change)="selectSingle(option.id)"
              />
              <span>{{ option.label }}</span>
            </label>
          }
        }
        @if (questionType() === "multi_choice") {
          @for (option of options(); track option.id) {
            <label
              class="decision-panel__option"
              [class.decision-panel__option--selected]="
                selectedOptions().includes(option.id)
              "
            >
              <input
                type="checkbox"
                [checked]="selectedOptions().includes(option.id)"
                (change)="toggleMulti(option.id)"
              />
              <span>{{ option.label }}</span>
            </label>
          }
        }
        @if (questionType() === "free_text") {
          <textarea
            class="decision-panel__textarea"
            [value]="freeText()"
            (input)="onTextInput($event)"
            placeholder="Enter your response..."
          ></textarea>
        }
      </div>

      <ng-container dialogFooter>
        <ui-button variant="outline" (clicked)="closed.emit()"
          >Cancel</ui-button
        >
        <ui-button
          variant="default"
          (clicked)="onSubmit()"
          [disabled]="!canSubmit()"
          >Submit</ui-button
        >
      </ng-container>
    </ui-dialog-panel>
  `,
})
export class DecisionPanelComponent implements AfterViewInit {
  private readonly anim = inject(AnimationService);
  private readonly el = inject(ElementRef);
  readonly title = input.required<string>();
  readonly description = input<string>("");
  readonly questionType = input.required<string>();
  readonly options = input<DecisionOption[]>([]);
  readonly closed = output();
  readonly submitted = output<{
    selectedOptions: string[];
    freeText: string;
  }>();

  protected readonly selectedOptions = signal<string[]>([]);
  protected readonly freeText = signal("");

  ngAfterViewInit(): void {
    const options = this.el.nativeElement.querySelectorAll(
      ".decision-panel__option",
    );
    this.anim.staggerIn(options);
  }

  protected canSubmit(): boolean {
    if (this.questionType() === "free_text")
      return this.freeText().trim().length > 0;
    return this.selectedOptions().length > 0;
  }

  protected selectSingle(id: string): void {
    this.selectedOptions.set([id]);
  }

  protected toggleMulti(id: string): void {
    const current = this.selectedOptions();
    if (current.includes(id)) {
      this.selectedOptions.set(current.filter((o) => o !== id));
    } else {
      this.selectedOptions.set([...current, id]);
    }
  }

  protected onTextInput(event: Event): void {
    this.freeText.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSubmit(): void {
    this.submitted.emit({
      selectedOptions: this.selectedOptions(),
      freeText: this.freeText(),
    });
  }
}
