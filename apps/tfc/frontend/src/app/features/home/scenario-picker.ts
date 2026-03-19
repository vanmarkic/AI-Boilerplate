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
  template: `
    <div class="dossier-grid">
      <span class="back-link" (click)="dismissed.emit()">Back</span>

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading scenarios...</p>
      }

      @for (s of scenarios(); track s.id) {
        <div class="dossier-card" (click)="picked.emit(s)">
          <span class="dossier-card__classification">Mission Briefing</span>
          <span class="dossier-card__title">{{ s.title }}</span>
          @if (s.description) {
            <span class="dossier-card__desc">{{ s.description }}</span>
          }
          <div class="dossier-card__meta">
            @if (s.content?.roles; as roles) {
              <span class="dossier-card__meta-item">
                <span class="dossier-card__meta-dot"></span>
                {{ roles.length }} stations
              </span>
            }
            @if (s.content?.game_mode; as gm) {
              <span class="dossier-card__meta-item">
                <span class="dossier-card__meta-dot"></span>
                {{ gm === "simple_collaborative" ? "Collaborative" : "Classic" }}
              </span>
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
