import { ChangeDetectorRef, Component, forwardRef, inject, input, model, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { cn } from '../utils';

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
      [class]="inputClasses"
    />
  `,
  host: { 'class': 'block mb-sm' },
})
export class InputComponent implements ControlValueAccessor {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = model('');  // kept for ngModel backwards-compat

  protected readonly currentValue = signal('');
  protected readonly isDisabled = signal(false);

  private readonly cdr = inject(ChangeDetectorRef);
  private onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  readonly inputClasses = cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm text-foreground placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  );

  writeValue(value: string): void {
    this.currentValue.set(value ?? '');
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
    this.value.set(value);  // keep model() in sync for ngModel users
  }
}
