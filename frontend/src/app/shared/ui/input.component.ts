import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../utils';

@Component({
  selector: 'app-input',
  imports: [FormsModule],
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
      [(ngModel)]="value"
      [class]="inputClasses"
    />
  `,
  host: { 'class': 'block mb-sm' },
})
export class InputComponent {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = model('');

  readonly inputClasses = cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm text-foreground placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );
}
