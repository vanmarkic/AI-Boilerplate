import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  maxlength: 'Value is too long',
  minlength: 'Value is too short',
};

@Component({
  selector: 'asp-form-error',
  template: `
    @if (control() && control()!.invalid && control()!.touched) {
      @for (key of errorKeys(); track key) {
        <p class="form-error">{{ getMessage(key) }}</p>
      }
    }
  `,
})
export class FormErrorComponent {
  readonly control = input<AbstractControl | null>(null);

  protected errorKeys(): string[] {
    return Object.keys(this.control()?.errors ?? {});
  }

  protected getMessage(key: string): string {
    return ERROR_MESSAGES[key] ?? key;
  }
}
