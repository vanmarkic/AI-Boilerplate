import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormErrorComponent } from '../../shared/ui/form-error.component';
import { InputComponent } from '../../shared/ui/input.component';
import { RegisterService } from './register.service';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputComponent, FormErrorComponent],
  template: `
    <div class="max-w-sm mx-auto mt-lg p-lg">
      <h1 class="text-2xl font-bold text-foreground mb-lg">Create Account</h1>

      @if (service.success()) {
        <p class="text-sm text-primary">Account created! You can now sign in.</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <app-input
            formControlName="name"
            label="Full name"
            placeholder="Alice Smith"
          />
          <app-form-error [control]="form.controls.name" />

          <app-input
            formControlName="email"
            type="email"
            label="Email address"
            placeholder="alice@example.com"
          />
          <app-form-error [control]="form.controls.email" />

          @if (service.error(); as error) {
            <p class="text-sm text-destructive mb-sm">{{ error }}</p>
          }

          <button
            type="submit"
            [disabled]="form.invalid || service.loading()"
            class="w-full h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ service.loading() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      }
    </div>
  `,
})
export class RegisterComponent {
  protected readonly service = inject(RegisterService);

  readonly form = new FormGroup({
    name: new FormControl('', {
      validators: [Validators.required, Validators.maxLength(100)],
      nonNullable: true,
    }),
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.service.register(this.form.getRawValue());
  }
}
