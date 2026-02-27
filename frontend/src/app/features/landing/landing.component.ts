import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex min-h-screen items-center justify-center bg-background px-md',
  },
  template: `
    <div class="flex flex-col items-center gap-lg text-center w-full max-w-sm">
      <div class="flex flex-col gap-sm">
        <h1 class="text-5xl font-bold text-foreground tracking-tight">
          AI Boilerplate
        </h1>
        <p class="text-lg text-muted-foreground">
          Ship your AI product. Faster.
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
            class="flex-1 px-md py-sm rounded-md bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base"
          />
          <button
            type="submit"
            class="px-md py-sm bg-primary text-primary-foreground rounded-md font-semibold text-base hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Get access
          </button>
        </form>
      } @else {
        <p class="text-primary font-semibold text-lg">
          You're on the list. We'll be in touch.
        </p>
      }
    </div>
  `,
})
export class LandingComponent {
  protected readonly email = signal('');
  protected readonly submitted = signal(false);

  submit(): void {
    if (this.email().trim()) {
      this.submitted.set(true);
    }
  }
}
