import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonDirective } from '@aspect/ui';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  host: {
    class: 'flex min-h-screen items-center justify-center bg-background px-md relative overflow-hidden',
  },
  template: `
    <!-- Subtle radial glow behind content -->
    <div
      class="pointer-events-none absolute center-xy rounded-full"
      style="width: 37.5rem; height: 37.5rem; opacity: 0.07; background: radial-gradient(circle, var(--color-primary) 0%, transparent 70%)"
    ></div>

    <div class="relative flex flex-col items-center gap-xl text-center w-full max-w-container-md">
      <!-- Monospace tag -->
      <span class="font-mono text-xs tracking-widest uppercase text-muted-foreground border px-sm py-xs rounded-sm whitespace-nowrap">
        v0.1 &middot; open source
      </span>

      <div class="flex flex-col gap-md">
        <h1 class="text-6xl font-bold text-foreground tracking-tight leading-none">
          AI<br />Boilerplate
        </h1>
        <p class="text-lg text-muted-foreground leading-relaxed">
          Production-ready stack for shipping AI products. Auth, API, database&mdash;wired up.
        </p>
      </div>

      @if (!submitted()) {
        <form (ngSubmit)="submit()" class="flex gap-sm w-full">
          <input
            type="email"
            placeholder="you@example.com"
            [value]="email()"
            (input)="email.set($any($event.target).value)"
            required
            class="input-base flex-1"
          />
          <button type="submit" appButton size="lg">
            Get access
          </button>
        </form>
      } @else {
        <div class="flex flex-col gap-sm items-center">
          <div class="rounded-full border-2 border-primary flex items-center justify-center" style="width: 2rem; height: 2rem">
            <svg class="text-primary" style="width: 1rem; height: 1rem" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="text-primary font-semibold text-lg">
            You're on the list.
          </p>
        </div>
      }

      <!-- Tech stack pills -->
      <div class="flex flex-row flex-wrap justify-center gap-sm self-stretch">
        @for (tech of stack; track tech) {
          <span class="font-mono text-xs text-muted-foreground bg-card border px-sm py-xs rounded-sm">
            {{ tech }}
          </span>
        }
      </div>
    </div>
  `,
})
export class LandingComponent {
  protected readonly email = signal('');
  protected readonly submitted = signal(false);
  protected readonly stack = ['Angular', 'FastAPI', 'Postgres', 'Keycloak'];

  submit(): void {
    if (this.email().trim()) {
      this.submitted.set(true);
    }
  }
}
