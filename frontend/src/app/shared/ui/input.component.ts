import { ChangeDetectorRef, Component, forwardRef, inject, input, model, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-input',
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label [for]="id()" class="block text-sm font-medium text-foreground mb-xs">
        {{ label() }}
      </label>
    }
    <input
      [id]="id()"
      [type]="type()"
      [placeholder]="placeholder()"
      [value]="currentValue()"
      [disabled]="isDisabled()"
      (input)="onInput($event)"
      (blur)="onTouched()"
      class="input-base"
    />
  `,
  host: { 'class': 'block mb-sm' },
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = model('');

  protected readonly currentValue = signal('');
  protected readonly isDisabled = signal(false);

  private readonly cdr = inject(ChangeDetectorRef);
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- CVA placeholder
  private onChange: (value: string) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- CVA placeholder
  protected onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.currentValue.set(value);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    this.cdr.markForCheck();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.currentValue.set(value);
    this.onChange(value);
    this.value.set(value);
  }
}
