import { TestBed } from "@angular/core/testing";
import { ExerciseStore } from "./exercise.store";
import type { SnapshotWithScore } from "./engine-api.service";

const minimalSnapshot: SnapshotWithScore = {
  exercise_id: 1,
  title: "Test",
  phase: "running",
  time: { play_time_ms: 0, real_time_ms: 0, factor: 1, paused: false },
  events: [],
  issues: [],
  systems: [],
  score: null,
};

describe("ExerciseStore", () => {
  let store: InstanceType<typeof ExerciseStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExerciseStore],
    });
    store = TestBed.inject(ExerciseStore);
  });

  describe("systems", () => {
    it("should initialize with empty systems array", () => {
      expect(store.systems()).toEqual([]);
    });

    it("should populate systems from snapshot", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        systems: [
          { system_id: "nav", label: "NAV", category: "sensor", power: true, operational: "green" },
        ],
      });
      expect(store.systems().length).toBe(1);
      expect(store.systems()[0].system_id).toBe("nav");
    });

    it("should update system state on applySystemChange", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        systems: [
          { system_id: "nav", label: "NAV", category: "sensor", power: true, operational: "green" },
        ],
      });
      store.applySystemChange({
        system_id: "nav",
        action: "operational_changed",
        power: true,
        operational: "red",
      });
      expect(store.systems()[0].operational).toBe("red");
      expect(store.systems()[0].power).toBe(true);
    });

    it("should update power state on applySystemChange", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        systems: [
          { system_id: "nav", label: "NAV", category: "sensor", power: true, operational: "green" },
        ],
      });
      store.applySystemChange({
        system_id: "nav",
        action: "power_changed",
        power: false,
        operational: "green",
      });
      expect(store.systems()[0].power).toBe(false);
    });

    it("should not modify other systems", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        systems: [
          { system_id: "nav", label: "NAV", category: "sensor", power: true, operational: "green" },
          { system_id: "comms", label: "COMMS", category: "comms", power: true, operational: "green" },
        ],
      });
      store.applySystemChange({
        system_id: "nav",
        action: "power_changed",
        power: false,
        operational: "red",
      });
      expect(store.systems()[1].power).toBe(true);
      expect(store.systems()[1].operational).toBe("green");
    });
  });

  describe("issuesWithCountdown", () => {
    it("returns empty when no active issues", () => {
      expect(store.issuesWithCountdown()).toEqual([]);
    });

    it("calculates remaining time for active issues with auto-resolve", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: { play_time_ms: 5000, real_time_ms: 5000, factor: 1, paused: false },
        issues: [
          {
            id: "i1",
            title: "Issue 1",
            description: "",
            trigger_mode: "manual",
            auto_resolve_ms: 10000,
            lifecycle: "active",
            activated_at_pt_ms: 2000,
            resolved_at_pt_ms: null,
            released: false,
          },
        ],
      });
      const countdown = store.issuesWithCountdown();
      expect(countdown.length).toBe(1);
      // elapsed = 5000 - 2000 = 3000, remaining = 10000 - 3000 = 7000
      expect(countdown[0].remaining_ms).toBe(7000);
    });

    it("returns 0 remaining when past auto-resolve time", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: { play_time_ms: 15000, real_time_ms: 15000, factor: 1, paused: false },
        issues: [
          {
            id: "i1",
            title: "Issue 1",
            description: "",
            trigger_mode: "manual",
            auto_resolve_ms: 10000,
            lifecycle: "active",
            activated_at_pt_ms: 2000,
            resolved_at_pt_ms: null,
            released: false,
          },
        ],
      });
      const countdown = store.issuesWithCountdown();
      expect(countdown[0].remaining_ms).toBe(0);
    });

    it("excludes issues without auto_resolve_ms", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: { play_time_ms: 5000, real_time_ms: 5000, factor: 1, paused: false },
        issues: [
          {
            id: "i1",
            title: "Issue 1",
            description: "",
            trigger_mode: "manual",
            auto_resolve_ms: 0,
            lifecycle: "active",
            activated_at_pt_ms: 2000,
            resolved_at_pt_ms: null,
            released: false,
          },
        ],
      });
      expect(store.issuesWithCountdown().length).toBe(0);
    });

    it("excludes inactive issues", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: { play_time_ms: 5000, real_time_ms: 5000, factor: 1, paused: false },
        issues: [
          {
            id: "i1",
            title: "Issue 1",
            description: "",
            trigger_mode: "manual",
            auto_resolve_ms: 10000,
            lifecycle: "inactive",
            activated_at_pt_ms: null,
            resolved_at_pt_ms: null,
            released: false,
          },
        ],
      });
      expect(store.issuesWithCountdown().length).toBe(0);
    });
  });

  describe("applyScoreChange", () => {
    it("should apply stress from score change", () => {
      store.applyScoreChange({
        total_score: 5.0,
        stress: 3,
        turn_number: 2,
        next_decision_time_ms: 270000,
      });
      expect(store.score()?.stress).toBe(3);
      expect(store.score()?.totalScore).toBe(5.0);
      expect(store.score()?.turnNumber).toBe(2);
    });
  });

  describe("openDecisions", () => {
    it("filters only open decisions", () => {
      store.applyDecisions([
        { id: "d1", title: "D1", status: "open" } as any,
        { id: "d2", title: "D2", status: "closed" } as any,
      ]);
      expect(store.openDecisions().length).toBe(1);
      expect(store.openDecisions()[0].id).toBe("d1");
    });
  });

  describe("closeDecision", () => {
    it("marks a decision as closed", () => {
      store.applyDecisions([{ id: "d1", title: "D1", status: "open" } as any]);
      store.closeDecision("d1");
      expect(store.openDecisions().length).toBe(0);
    });
  });
});
