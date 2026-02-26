import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  template: `
    <h1>Login</h1>
    <p>Auth is stubbed. Click to proceed.</p>
    <button (click)="login()">Login (Stub)</button>
  `,
})
export class LoginComponent {
  private readonly router = inject(Router);

  login(): void {
    this.router.navigate(['/dashboard']);
  }
}
