import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestBed } from "@angular/core/testing";
import { Router, type ActivatedRouteSnapshot } from "@angular/router";
import { of, throwError } from "rxjs";
import { practiceRedirectGuard } from "./practice-redirect.guard";
import { ExerciseApiService } from "../../core/exercise-api.service";

describe("practiceRedirectGuard", () => {
  let exerciseApi: { get: ReturnType<typeof vi.fn> };
  let router: { createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    exerciseApi = { get: vi.fn() };
    router = { createUrlTree: vi.fn().mockReturnValue("/player-url-tree") };

    TestBed.configureTestingModule({
      providers: [
        { provide: ExerciseApiService, useValue: exerciseApi },
        { provide: Router, useValue: router },
      ],
    });
  });

  function runGuard(queryParams: Record<string, string>) {
    const route = { queryParams } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => practiceRedirectGuard(route));
  }

  it("allows navigation when no exerciseId is present", () => {
    expect(runGuard({})).toBe(true);
  });

  it("allows navigation for non-practice exercises", () =>
    new Promise<void>((done) => {
      exerciseApi.get.mockReturnValue(
        of({ id: 1, practice_mode: false, game_mode: "classic" }),
      );

      const result$ = runGuard({ exerciseId: "1" });
      (result$ as ReturnType<typeof of>).subscribe((val) => {
        expect(val).toBe(true);
        done();
      });
    }));

  it("redirects to /player for practice exercises", () =>
    new Promise<void>((done) => {
      exerciseApi.get.mockReturnValue(
        of({ id: 42, practice_mode: true, game_mode: "simple_collaborative" }),
      );

      const result$ = runGuard({ exerciseId: "42" });
      (result$ as ReturnType<typeof of>).subscribe((val) => {
        expect(router.createUrlTree).toHaveBeenCalledWith(["/player"], {
          queryParams: {
            exerciseId: 42,
            role: "all_roles",
            gameMode: "simple_collaborative",
            practiceMode: true,
          },
        });
        expect(val).toBe("/player-url-tree");
        done();
      });
    }));

  it("allows navigation when exercise fetch fails", () =>
    new Promise<void>((done) => {
      exerciseApi.get.mockReturnValue(throwError(() => new Error("Not found")));

      const result$ = runGuard({ exerciseId: "99" });
      (result$ as ReturnType<typeof of>).subscribe((val) => {
        expect(val).toBe(true);
        done();
      });
    }));
});
