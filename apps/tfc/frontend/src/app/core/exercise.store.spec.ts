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
  warfare_domains: [],
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
          {
            system_id: "nav",
            label: "NAV",
            category: "sensor",
            power: true,
            operational: "green",
          },
        ],
      });
      expect(store.systems().length).toBe(1);
      expect(store.systems()[0].system_id).toBe("nav");
    });

    it("should update system state on applySystemChange", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        systems: [
          {
            system_id: "nav",
            label: "NAV",
            category: "sensor",
            power: true,
            operational: "green",
          },
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
          {
            system_id: "nav",
            label: "NAV",
            category: "sensor",
            power: true,
            operational: "green",
          },
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
          {
            system_id: "nav",
            label: "NAV",
            category: "sensor",
            power: true,
            operational: "green",
          },
          {
            system_id: "comms",
            label: "COMMS",
            category: "comms",
            power: true,
            operational: "green",
          },
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
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
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
        time: {
          play_time_ms: 15000,
          real_time_ms: 15000,
          factor: 1,
          paused: false,
        },
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
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
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
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
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
        score_tier: null,
      });
      expect(store.score()?.stress).toBe(3);
      expect(store.score()?.scoreTier).toBe(null);
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

  describe("decisionCountdownMs", () => {
    it("returns null when no open decision", () => {
      expect(store.decisionCountdownMs()).toBeNull();
    });

    it("computes remaining time from play-time coordinates", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: {
          play_time_ms: 60000,
          real_time_ms: 60000,
          factor: 1,
          paused: false,
        },
        decisions: [
          {
            id: "d1",
            title: "D1",
            status: "open",
            timeout_ms: 300000, // 5 minutes
            opened_at_pt_ms: 50000,
          } as any,
        ],
      });
      // deadline = 50000 + 300000 = 350000, remaining = 350000 - 60000 = 290000
      expect(store.decisionCountdownMs()).toBe(290000);
    });

    it("resets correctly when a new decision opens at a later play time", () => {
      // Simulate Turn 1: decision opened at pt=60000, timeout 300000ms
      store.applySnapshot({
        ...minimalSnapshot,
        time: {
          play_time_ms: 70000,
          real_time_ms: 70000,
          factor: 1,
          paused: false,
        },
        decisions: [
          {
            id: "d1",
            title: "D1",
            status: "open",
            timeout_ms: 300000,
            opened_at_pt_ms: 60000,
          } as any,
        ],
      });
      // remaining = (60000 + 300000) - 70000 = 290000
      expect(store.decisionCountdownMs()).toBe(290000);

      // CO submits Turn 1 at pt=70000, Turn 2 opens at pt=70000
      store.applyDecisions([
        {
          id: "d1",
          title: "D1",
          status: "closed",
          timeout_ms: 300000,
          opened_at_pt_ms: 60000,
        } as any,
        {
          id: "d2",
          title: "D2",
          status: "open",
          timeout_ms: 300000,
          opened_at_pt_ms: 70000,
        } as any,
      ]);
      // remaining = (70000 + 300000) - 70000 = 300000 (full timeout)
      expect(store.decisionCountdownMs()).toBe(300000);
    });

    it("works correctly with speed factor > 1", () => {
      // At 2x speed: play time advances twice as fast as real time
      store.applySnapshot({
        ...minimalSnapshot,
        time: {
          play_time_ms: 120000,
          real_time_ms: 60000,
          factor: 2,
          paused: false,
        },
        decisions: [
          {
            id: "d1",
            title: "D1",
            status: "open",
            timeout_ms: 300000,
            opened_at_pt_ms: 100000,
          } as any,
        ],
      });
      // deadline = 100000 + 300000 = 400000, remaining = 400000 - 120000 = 280000
      expect(store.decisionCountdownMs()).toBe(280000);
    });

    it("clamps to zero when past deadline", () => {
      store.applySnapshot({
        ...minimalSnapshot,
        time: {
          play_time_ms: 400000,
          real_time_ms: 400000,
          factor: 1,
          paused: false,
        },
        decisions: [
          {
            id: "d1",
            title: "D1",
            status: "open",
            timeout_ms: 300000,
            opened_at_pt_ms: 50000,
          } as any,
        ],
      });
      // deadline = 50000 + 300000 = 350000, playTime = 400000 → clamped to 0
      expect(store.decisionCountdownMs()).toBe(0);
    });
  });
});
