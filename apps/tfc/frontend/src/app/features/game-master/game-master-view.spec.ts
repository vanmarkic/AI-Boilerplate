import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideRouter } from "@angular/router";
import { ActivatedRoute, Router } from "@angular/router";
import { GameMasterView } from "./game-master-view";
import { ExerciseWsService } from "../../core/exercise-ws.service";
import { environment } from "../../core/environment";
import type { ScenarioResponse } from "../../core/scenario-api.service";
import type { ExerciseResponse } from "../../core/exercise-api.service";
import { Subject } from "rxjs";
import { vi } from "vitest";

describe("GameMasterView", () => {
  let fixture: ComponentFixture<GameMasterView>;
  let component: GameMasterView;
  let httpTesting: HttpTestingController;
  let router: Router;
  const base = environment.apiBaseUrl;
  const wsMessages$ = new Subject<Record<string, unknown>>();
  const wsConnected$ = new Subject<boolean>();

  const mockWs = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    messages$: wsMessages$.asObservable(),
    connected$: wsConnected$.asObservable(),
  };

  const stubScenario: ScenarioResponse = {
    id: 10,
    title: "Test Scenario",
    description: "A test",
    domain_id: null,
    content: {
      phases: [],
      events: [],
      issues: [],
      decision_templates: [],
      default_time_factor: 2.5,
    },
    version: 1,
    created_at: "2026-03-17T00:00:00Z",
    updated_at: "2026-03-17T00:00:00Z",
  };

  const stubExercise: ExerciseResponse = {
    id: 99,
    title: "Test Scenario",
    description: "",
    phase: "setup",
    scenario_id: 10,
    domain_id: null,
    time_factor: 2.5,
    game_mode: "classic",
    practice_mode: false,
    session_code: "TEST99",
    created_at: "2026-03-17T00:00:00Z",
    updated_at: "2026-03-17T00:00:00Z",
  };

  function setup(queryParams: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      imports: [GameMasterView],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams } },
        },
      ],
    })
      .overrideProvider(ExerciseWsService, { useValue: mockWs })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, "navigate").mockResolvedValue(true);
    fixture = TestBed.createComponent(GameMasterView);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
    httpTesting.verify();
  });

  /** Flush the exercise list + scenario list requests fired on init. */
  function flushInitRequests(): void {
    httpTesting.expectOne(`${base}/api/exercises`).flush([]);
    httpTesting.expectOne(`${base}/api/scenarios`).flush([]);
  }

  describe("without exerciseId query param", () => {
    beforeEach(() => setup());

    it("shows scenario picker and exercise list when no exercise is selected", () => {
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      const picker = fixture.nativeElement.querySelector("tfc-scenario-picker");
      expect(picker).toBeTruthy();
      const list = fixture.nativeElement.querySelector("tfc-exercise-list");
      expect(list).toBeTruthy();
      const exerciseLayout =
        fixture.nativeElement.querySelector(".exercise-layout");
      expect(exerciseLayout).toBeNull();
    });

    it("navigates to waiting room after scenario selection", () => {
      fixture.detectChanges();
      httpTesting.expectOne(`${base}/api/exercises`).flush([]);
      httpTesting.expectOne(`${base}/api/scenarios`).flush([stubScenario]);
      fixture.detectChanges();

      component["onScenarioSelected"]({
        scenario: stubScenario,
        gameMode: "classic",
      });

      const createReq = httpTesting.expectOne(`${base}/api/exercises`);
      expect(createReq.request.method).toBe("POST");
      expect(createReq.request.body.title).toBe("Test Scenario");
      expect(createReq.request.body.scenario_id).toBe(10);
      expect(createReq.request.body.time_factor).toBe(2.5);
      createReq.flush(stubExercise);

      expect(router.navigate).toHaveBeenCalledWith(["/waiting-room"], {
        queryParams: { exerciseId: 99 },
      });
    });

    it("passes time_factor from scenario content when creating exercise", () => {
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      const scenarioWithFactor: ScenarioResponse = {
        ...stubScenario,
        content: { ...stubScenario.content!, default_time_factor: 5.0 },
      };
      component["onScenarioSelected"]({
        scenario: scenarioWithFactor,
        gameMode: "classic",
      });

      const createReq = httpTesting.expectOne(`${base}/api/exercises`);
      expect(createReq.request.body.time_factor).toBe(5.0);
      createReq.flush(stubExercise);
    });

    it("defaults time_factor to 1.0 when scenario has no content", () => {
      fixture.detectChanges();
      flushInitRequests();
      fixture.detectChanges();

      const noContent: ScenarioResponse = { ...stubScenario, content: null };
      component["onScenarioSelected"]({
        scenario: noContent,
        gameMode: "classic",
      });

      const createReq = httpTesting.expectOne(`${base}/api/exercises`);
      expect(createReq.request.body.time_factor).toBe(1.0);
      createReq.flush({ ...stubExercise, time_factor: 1.0 });
    });

    it("disconnects websocket on destroy", () => {
      fixture.detectChanges();
      flushInitRequests();

      fixture.destroy();
      expect(mockWs.disconnect).toHaveBeenCalled();
    });
  });

  describe("with exerciseId query param", () => {
    beforeEach(() => setup({ exerciseId: "99" }));

    it("connects to exercise from query params on init", () => {
      fixture.detectChanges();

      expect(mockWs.connect).toHaveBeenCalledWith(99, "gm");

      const snapReq = httpTesting.expectOne(
        `${base}/api/exercises/99/engine/snapshot`,
      );
      snapReq.flush({
        exercise_id: 99,
        title: "Test Scenario",
        phase: "setup",
        time: { play_time_ms: 0, real_time_ms: 0, factor: 2.5, paused: true },
        events: [],
        issues: [],
        score: null,
      });
      httpTesting
        .expectOne(
          (r) => r.url === `${base}/api/exercises/99/engine/context`,
        )
        .flush({ title: "Test", briefing: "", objectives: [], rules: [] });

      fixture.detectChanges();

      const layout = fixture.nativeElement.querySelector(".exercise-layout");
      expect(layout).toBeTruthy();
    });
  });
});
