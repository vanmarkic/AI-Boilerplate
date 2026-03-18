import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  OnInit,
} from "@angular/core";
import {
  ScenarioApiService,
  type ScenarioResponse,
} from "../../core/scenario-api.service";

@Component({
  selector: "tfc-scenario-picker",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  styles: [
    `
      :host {
        display: block;
      }

      .picker-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--spacing-md);
        max-width: 560px;
        width: 100%;
      }

      .scenario-card {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        padding: var(--spacing-lg);
        background: var(--glass-bg);
        backdrop-filter: blur(var(--glass-blur));
        -webkit-backdrop-filter: blur(var(--glass-blur));
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg, 0.75rem);
        cursor: pointer;
        transition:
          border-color 0.15s,
          background 0.15s;
      }

      .scenario-card:hover {
        border-color: var(--color-primary);
        background: color-mix(
          in oklch,
          var(--glass-bg) 80%,
          var(--color-primary) 20%
        );
      }

      .scenario-title {
        font-size: var(--font-size-md, 1rem);
        font-weight: 600;
      }

      .scenario-desc {
        font-size: var(--font-size-xs, 0.75rem);
        color: var(--color-muted-foreground);
        line-height: 1.4;
      }

      .scenario-meta {
        display: flex;
        gap: var(--spacing-sm);
        font-size: var(--font-size-xs, 0.75rem);
        color: var(--color-muted-foreground);
      }

      .back-link {
        font-size: var(--font-size-sm, 0.875rem);
        color: var(--color-muted-foreground);
        text-decoration: none;
        cursor: pointer;
        margin-bottom: var(--spacing-sm);
      }
    `,
  ],
  template: `
    <div class="picker-grid">
      <span class="back-link" (click)="dismissed.emit()">&larr; Back</span>

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading scenarios...</p>
      }

      @for (s of scenarios(); track s.id) {
        <div class="scenario-card" (click)="picked.emit(s)">
          <span class="scenario-title">{{ s.title }}</span>
          @if (s.description) {
            <span class="scenario-desc">{{ s.description }}</span>
          }
          <div class="scenario-meta">
            @if (s.content?.roles; as roles) {
              <span>{{ roles.length }} roles</span>
            }
            @if (s.content?.game_mode; as gm) {
              <span>{{
                gm === "simple_collaborative" ? "Collaborative" : "Classic"
              }}</span>
            }
          </div>
        </div>
      } @empty {
        @if (!loading()) {
          <p class="text-sm text-muted-foreground">No scenarios available.</p>
        }
      }
    </div>
  `,
})
export class ScenarioPicker implements OnInit {
  private readonly scenarioApi = inject(ScenarioApiService);

  protected readonly scenarios = signal<ScenarioResponse[]>([]);
  protected readonly loading = signal(true);

  readonly picked = output<ScenarioResponse>();
  readonly dismissed = output<void>();

  ngOnInit(): void {
    this.scenarioApi.list().subscribe({
      next: (list) => {
        this.scenarios.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
