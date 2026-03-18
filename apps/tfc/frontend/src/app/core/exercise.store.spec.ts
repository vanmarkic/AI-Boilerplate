import { TestBed } from "@angular/core/testing";
import { ExerciseStore } from "./exercise.store";

describe("ExerciseStore", () => {
  let store: InstanceType<typeof ExerciseStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ExerciseStore],
    });
    store = TestBed.inject(ExerciseStore);
  });

  describe("issuesWithCountdown", () => {
    it("returns empty when no active issues", () => {
      expect(store.issuesWithCountdown()).toEqual([]);
    });

    it("calculates remaining time for active issues with auto-resolve", () => {
      store.applySnapshot({
        exercise_id: 1,
        title: "Test",
        phase: "running",
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
        events: [],
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
        score: null,
      });
      const countdown = store.issuesWithCountdown();
      expect(countdown.length).toBe(1);
      // elapsed = 5000 - 2000 = 3000, remaining = 10000 - 3000 = 7000
      expect(countdown[0].remaining_ms).toBe(7000);
    });

    it("returns 0 remaining when past auto-resolve time", () => {
      store.applySnapshot({
        exercise_id: 1,
        title: "Test",
        phase: "running",
        time: {
          play_time_ms: 15000,
          real_time_ms: 15000,
          factor: 1,
          paused: false,
        },
        events: [],
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
        score: null,
      });
      const countdown = store.issuesWithCountdown();
      expect(countdown[0].remaining_ms).toBe(0);
    });

    it("excludes issues without auto_resolve_ms", () => {
      store.applySnapshot({
        exercise_id: 1,
        title: "Test",
        phase: "running",
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
        events: [],
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
        score: null,
      });
      expect(store.issuesWithCountdown().length).toBe(0);
    });

    it("excludes inactive issues", () => {
      store.applySnapshot({
        exercise_id: 1,
        title: "Test",
        phase: "running",
        time: {
          play_time_ms: 5000,
          real_time_ms: 5000,
          factor: 1,
          paused: false,
        },
        events: [],
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
        score: null,
      });
      expect(store.issuesWithCountdown().length).toBe(0);
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
