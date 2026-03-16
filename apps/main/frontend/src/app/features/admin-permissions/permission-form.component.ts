import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputComponent, FormErrorComponent, ButtonDirective } from '@aspect/ui';
import type { PermissionMapping } from './admin-permissions.types';

export interface PermissionFormValue {
  role: string;
  route_pattern: string;
  method: string;
  frontend_route: string | null;
}

@Component({
  selector: 'app-permission-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, InputComponent, FormErrorComponent, ButtonDirective],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-md">
      <ui-input formControlName="role" label="Role" placeholder="e.g. admin" />
      <ui-form-error [control]="form.controls.role" />
      <ui-input
        formControlName="route_pattern"
        label="Route Pattern"
        placeholder="/api/..."
      />
      <ui-form-error [control]="form.controls.route_pattern" />
      <ui-input
        formControlName="method"
        label="HTTP Method"
        placeholder="GET, POST, *, etc."
      />
      <ui-form-error [control]="form.controls.method" />
      <ui-input
        formControlName="frontend_route"
        label="Frontend Route (optional)"
        placeholder="/dashboard"
      />
      <div class="flex gap-sm justify-end">
        <button uiButton [variant]="'outline'" type="button" (click)="cancelled.emit()">
          Cancel
        </button>
        <button uiButton type="submit">Save</button>
      </div>
    </form>
  `,
})
export class PermissionFormComponent {
  readonly permission = input<PermissionMapping | null>(null);
  readonly submitted = output<PermissionFormValue>();
  readonly cancelled = output();

  readonly form = new FormGroup({
    role: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    route_pattern: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    method: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    frontend_route: new FormControl('', { nonNullable: true }),
  });

  private readonly _syncForm = effect(() => {
    const perm = this.permission();
    if (perm) {
      this.form.patchValue({
        role: perm.role,
        route_pattern: perm.route_pattern,
        method: perm.method,
        frontend_route: perm.frontend_route ?? '',
      });
    } else {
      this.form.reset();
    }
  });

  protected onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.submitted.emit({
      ...raw,
      frontend_route: raw.frontend_route || null,
    });
  }
}
