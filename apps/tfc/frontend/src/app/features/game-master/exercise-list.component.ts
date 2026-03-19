import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
} from "@angular/core";
import { CardComponent, ButtonDirective, BadgeComponent } from "@aspect/ui";
import { DomainService } from "../../core/domain.service";
import { ExerciseApiService } from "../../core/exercise-api.service";
import type { ExerciseResponse } from "../../core/exercise-api.service";
import { PhaseBadgeComponent } from "../../shared/phase-badge.component";

@Component({
  selector: "tfc-exercise-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, ButtonDirective, BadgeComponent, PhaseBadgeComponent],
  template: `
    <div class="flex flex-col gap-md">
      <h2 class="text-lg font-semibold">
        Existing {{ domain.term("exercise") }}s
      </h2>

      @if (loading()) {
        <p class="text-sm text-muted-foreground">Loading...</p>
      } @else if (error()) {
        <p class="text-sm text-destructive">{{ error() }}</p>
        <button uiButton variant="outline" size="sm" (click)="load()">
          Retry
        </button>
      } @else {
        <div class="grid grid-cols-1 gap-sm">
          @for (exercise of exercises(); track exercise.id) {
            <ui-card [title]="exercise.title">
              <div class="flex items-center justify-between p-sm">
                <div class="flex flex-col gap-xs">
                  <div class="flex gap-xs flex-wrap items-center">
                    <tfc-phase-badge [phase]="exercise.phase" />
                    <ui-badge variant="secondary">
                      {{ exercise.game_mode }}
                    </ui-badge>
                    <ui-badge variant="outline">
                      {{ exercise.session_code }}
                    </ui-badge>
                  </div>
                </div>
                <div class="flex gap-xs">
                  <button
                    uiButton
                    variant="default"
                    size="sm"
                    (click)="exerciseSelected.emit(exercise)"
                  >
                    Resume
                  </button>
                  <button
                    uiButton
                    variant="destructive"
                    size="sm"
                    (click)="onDelete(exercise)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </ui-card>
          } @empty {
            <p class="text-muted-foreground text-sm">
              No existing {{ domain.term("exercise") }}s.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class ExerciseListComponent implements OnInit {
  readonly exerciseSelected = output<ExerciseResponse>();

  protected readonly domain = inject(DomainService);
  private readonly api = inject(ExerciseApiService);
  protected readonly exercises = signal<ExerciseResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (list) => {
        this.exercises.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Failed to load exercises");
        this.loading.set(false);
      },
    });
  }

  protected onDelete(exercise: ExerciseResponse): void {
    this.api.delete(exercise.id).subscribe({
      next: () =>
        this.exercises.update((list) =>
          list.filter((e) => e.id !== exercise.id),
        ),
    });
  }
}
