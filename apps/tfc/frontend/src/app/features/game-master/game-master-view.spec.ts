import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
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

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [GameMasterView],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideProvider(ExerciseWsService, { useValue: mockWs })
      .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GameMasterView);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
    httpTesting.verify();
  });

  it("shows scenario picker when no exercise is selected", () => {
    fixture.detectChanges();
    // Flush the scenario list request from the picker's ngOnInit
    const req = httpTesting.expectOne(`${base}/api/scenarios`);
    req.flush([]);
    fixture.detectChanges();

    const picker = fixture.nativeElement.querySelector("tfc-scenario-picker");
    expect(picker).toBeTruthy();
    const exerciseLayout =
      fixture.nativeElement.querySelector(".exercise-layout");
    expect(exerciseLayout).toBeNull();
  });

  it("does not show exercise control panel before scenario selection", () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/scenarios`);
    req.flush([]);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector(".exercise-header");
    expect(header).toBeNull();
  });

  it("creates exercise and shows control panel after scenario selection", () => {
    fixture.detectChanges();
    // Flush scenario list
    const listReq = httpTesting.expectOne(`${base}/api/scenarios`);
    listReq.flush([stubScenario]);
    fixture.detectChanges();

    // Simulate scenario selection
    component["onScenarioSelected"]({
      scenario: stubScenario,
      gameMode: "classic",
    });

    // Flush exercise creation
    const createReq = httpTesting.expectOne(`${base}/api/exercises`);
    expect(createReq.request.method).toBe("POST");
    expect(createReq.request.body.title).toBe("Test Scenario");
    expect(createReq.request.body.scenario_id).toBe(10);
    expect(createReq.request.body.time_factor).toBe(2.5);
    createReq.flush(stubExercise);

    // Flush snapshot request
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

    // Flush context request
    const ctxReq = httpTesting.expectOne(
      (r) => r.url === `${base}/api/exercises/99/engine/context`,
    );
    ctxReq.flush({ title: "Test", briefing: "", objectives: [], rules: [] });

    fixture.detectChanges();

    // Picker should be gone, control panel should appear
    const picker = fixture.nativeElement.querySelector("tfc-scenario-picker");
    expect(picker).toBeNull();
    const layout = fixture.nativeElement.querySelector(".exercise-layout");
    expect(layout).toBeTruthy();
  });

  it("connects websocket with exercise id and gm role after selection", () => {
    fixture.detectChanges();
    const listReq = httpTesting.expectOne(`${base}/api/scenarios`);
    listReq.flush([]);
    fixture.detectChanges();

    component["onScenarioSelected"]({
      scenario: stubScenario,
      gameMode: "classic",
    });

    const createReq = httpTesting.expectOne(`${base}/api/exercises`);
    createReq.flush(stubExercise);

    // Verify WS connection
    expect(mockWs.connect).toHaveBeenCalledWith(99, "gm");

    // Flush remaining requests
    const snapReq = httpTesting.expectOne(
      `${base}/api/exercises/99/engine/snapshot`,
    );
    snapReq.flush({
      exercise_id: 99,
      title: "",
      phase: "setup",
      time: { play_time_ms: 0, real_time_ms: 0, factor: 1, paused: true },
      events: [],
      issues: [],
      score: null,
    });
    const ctxReq = httpTesting.expectOne(
      (r) => r.url === `${base}/api/exercises/99/engine/context`,
    );
    ctxReq.flush({ title: "", briefing: "", objectives: [], rules: [] });
  });

  it("disconnects websocket on destroy", () => {
    fixture.detectChanges();
    const listReq = httpTesting.expectOne(`${base}/api/scenarios`);
    listReq.flush([]);

    fixture.destroy();
    expect(mockWs.disconnect).toHaveBeenCalled();
  });

  it("passes time_factor from scenario content when creating exercise", () => {
    fixture.detectChanges();
    const listReq = httpTesting.expectOne(`${base}/api/scenarios`);
    listReq.flush([]);
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

    // Flush remaining
    httpTesting.expectOne(`${base}/api/exercises/99/engine/snapshot`).flush({
      exercise_id: 99,
      title: "",
      phase: "setup",
      time: { play_time_ms: 0, real_time_ms: 0, factor: 5.0, paused: true },
      events: [],
      issues: [],
      score: null,
    });
    httpTesting
      .expectOne((r) => r.url === `${base}/api/exercises/99/engine/context`)
      .flush({ title: "", briefing: "", objectives: [], rules: [] });
  });

  it("defaults time_factor to 1.0 when scenario has no content", () => {
    fixture.detectChanges();
    const listReq = httpTesting.expectOne(`${base}/api/scenarios`);
    listReq.flush([]);
    fixture.detectChanges();

    const noContent: ScenarioResponse = { ...stubScenario, content: null };
    component["onScenarioSelected"]({
      scenario: noContent,
      gameMode: "classic",
    });

    const createReq = httpTesting.expectOne(`${base}/api/exercises`);
    expect(createReq.request.body.time_factor).toBe(1.0);
    createReq.flush({ ...stubExercise, time_factor: 1.0 });

    httpTesting.expectOne(`${base}/api/exercises/99/engine/snapshot`).flush({
      exercise_id: 99,
      title: "",
      phase: "setup",
      time: { play_time_ms: 0, real_time_ms: 0, factor: 1.0, paused: true },
      events: [],
      issues: [],
      score: null,
    });
    httpTesting
      .expectOne((r) => r.url === `${base}/api/exercises/99/engine/context`)
      .flush({ title: "", briefing: "", objectives: [], rules: [] });
  });
});
