import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'tfc-home-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styles: [`
    .home-layout {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: var(--space-xl);
      gap: var(--space-xl);
    }

    .home-hero {
      text-align: center;
    }

    .home-hero h1 {
      font-size: var(--font-size-3xl, 2rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 var(--space-xs);
    }

    .home-hero p {
      color: var(--color-muted-foreground);
      margin: 0;
    }

    .home-menu {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-md);
      width: 100%;
      max-width: 560px;
    }

    .menu-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      padding: var(--space-lg);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg, 0.75rem);
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, background 0.15s;
      cursor: pointer;
    }

    .menu-card:hover {
      border-color: var(--color-primary);
      background: var(--color-card-hover, var(--color-accent));
    }

    .menu-card[data-primary] {
      border-color: var(--color-primary);
      background: color-mix(in oklch, var(--color-primary) 12%, var(--color-card));
    }

    .menu-card[data-primary]:hover {
      background: color-mix(in oklch, var(--color-primary) 20%, var(--color-card));
    }

    .card-icon {
      font-size: 1.5rem;
      line-height: 1;
    }

    .card-label {
      font-size: var(--font-size-sm, 0.875rem);
      font-weight: 600;
    }

    .card-desc {
      font-size: var(--font-size-xs, 0.75rem);
      color: var(--color-muted-foreground);
      line-height: 1.4;
    }
  `],
  template: `
    <div class="home-layout">
      <div class="home-hero">
        <h1>Training Flow Control</h1>
        <p>Collaborative exercise simulation platform</p>
      </div>

      <nav class="home-menu" aria-label="Main menu">
        <a class="menu-card" data-primary routerLink="/join">
          <span class="card-icon">🎮</span>
          <span class="card-label">Join Exercise</span>
          <span class="card-desc">Enter a session code to join an active exercise</span>
        </a>

        <a class="menu-card" routerLink="/join" [queryParams]="{ role: 'game-master' }">
          <span class="card-icon">🎯</span>
          <span class="card-label">Run Exercise</span>
          <span class="card-desc">Facilitate and control an exercise session</span>
        </a>

        <a class="menu-card" routerLink="/builder">
          <span class="card-icon">🛠️</span>
          <span class="card-label">Build Scenario</span>
          <span class="card-desc">Create and edit exercise scenarios</span>
        </a>

        <a class="menu-card" routerLink="/review">
          <span class="card-icon">📊</span>
          <span class="card-label">Review Results</span>
          <span class="card-desc">Analyse past exercise outcomes and decisions</span>
        </a>
      </nav>
    </div>
  `,
})
export class HomeView {}
