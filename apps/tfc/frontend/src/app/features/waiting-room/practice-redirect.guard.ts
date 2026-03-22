import { inject } from "@angular/core";
import { type ActivatedRouteSnapshot, Router } from "@angular/router";
import { catchError, map, of } from "rxjs";
import { ExerciseApiService } from "../../core/exercise-api.service";

/**
 * Redirects practice-mode exercises away from the waiting room
 * directly to the player view — there's no one to wait for.
 */
export function practiceRedirectGuard(route: ActivatedRouteSnapshot) {
  const exerciseId = Number(route.queryParams["exerciseId"] ?? 0);
  if (!exerciseId) return true;

  const exerciseApi = inject(ExerciseApiService);
  const router = inject(Router);

  return exerciseApi.get(exerciseId).pipe(
    map((exercise) => {
      if (!exercise.practice_mode) return true;
      return router.createUrlTree(["/player"], {
        queryParams: {
          exerciseId: exercise.id,
          role: "all_roles",
          gameMode: exercise.game_mode,
          practiceMode: true,
        },
      });
    }),
    catchError(() => of(true)),
  );
}
