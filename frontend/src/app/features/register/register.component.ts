import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FormErrorComponent } from '../../shared/ui/form-error.component';
import { InputComponent } from '../../shared/ui/input.component';
import { RegisterStore } from './register.store';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputComponent, FormErrorComponent, ButtonDirective],
  providers: [RegisterStore],
  template: `
    <div class="max-w-container-sm mx-auto mt-lg p-lg">
      <h1 class="text-2xl font-bold text-foreground mb-lg">Create Account</h1>

      @if (store.success()) {
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

          @if (store.error(); as error) {
            <p class="text-sm text-destructive mb-sm">{{ error }}</p>
          }

          <button
            type="submit"
            appButton
            class="w-full"
            [disabled]="form.invalid || store.loading()"
          >
            {{ store.loading() ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
      }
    </div>
  `,
})
export class RegisterComponent {
  protected readonly store = inject(RegisterStore);

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
    void this.store.register(this.form.getRawValue());
  }
}
