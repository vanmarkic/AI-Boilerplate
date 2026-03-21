import { TestBed } from "@angular/core/testing";
import { ExerciseStore } from "./exercise.store";
import { handleStateChange, toActiveDecision } from "./ws-state-handler";
import type { DecisionOpened, PhaseChange } from "./generated/state-changes.types";

describe("ws-state-handler", () => {
  let store: InstanceType<typeof ExerciseStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExerciseStore] });
    store = TestBed.inject(ExerciseStore);
  });

  describe("toActiveDecision", () => {
    it("maps DecisionOpened to ActiveDecision", () => {
      const opened: DecisionOpened = {
        type: "decision_opened",
        id: "d1",
        decision_id: "d1",
        event_id: null,
        issue_id: "i1",
        title: "Fix the bug?",
        description: "Choose wisely",
        question_type: "single_choice",
        options: [{ id: "o1", label: "Yes", score: 10, stress_delta: 0, system_effects: [], targets_system: false, max_plays: 1, role: null }],
        completion_mode: "first_response",
        target_roles: ["advisor"],
        timeout_ms: 30000,
        max_selections: 1,
        status: "open",
        opened_at_pt_ms: 5000,
        closed_at_pt_ms: null,
        recommendations: {},
      };
      const result = toActiveDecision(opened);
      expect(result.id).toBe("d1");
      expect(result.title).toBe("Fix the bug?");
      expect(result.max_selections).toBe(1);
      expect(result.status).toBe("open");
      expect(result.closed_at_pt_ms).toBeNull();
    });
  });

  describe("handleStateChange", () => {
    it("applies phase_change to store", () => {
      const change: PhaseChange = {
        type: "phase_change",
        action: "started",
        phase: "running",
        time: { play_time_ms: 1000, real_time_ms: 1000, factor: 1, paused: false },
      };
      handleStateChange(change, store);
      expect(store.phase()).toBe("running");
      expect(store.playTimeMs()).toBe(1000);
    });

    it("appends decision on decision_opened", () => {
      const change: DecisionOpened = {
        type: "decision_opened",
        id: "d1",
        decision_id: "d1",
        event_id: null,
        issue_id: null,
        title: "Test",
        description: "",
        question_type: "single_choice",
        options: [],
        completion_mode: "first_response",
        target_roles: [],
        timeout_ms: 0,
        max_selections: null,
        status: "open",
        opened_at_pt_ms: 0,
        closed_at_pt_ms: null,
        recommendations: {},
      };
      handleStateChange(change, store);
      expect(store.openDecisions().length).toBe(1);
      expect(store.openDecisions()[0].id).toBe("d1");
    });

    it("closes decision on decision_closed", () => {
      store.applyDecisions([
        { id: "d1", title: "T", status: "open" } as any,
      ]);
      handleStateChange(
        { type: "decision_closed", decision_id: "d1", title: "T", selected_option_ids: [] },
        store,
      );
      expect(store.openDecisions().length).toBe(0);
    });
  });
});
