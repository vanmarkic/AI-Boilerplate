import { describe, it, expect } from "vitest";
import type {
  EventSnapshot,
  IssueSnapshot,
} from "../../core/engine-api.service";
import {
  assignLanes,
  computeTimelineItems,
  computeTimeScale,
  type TimelineItem,
} from "./timeline-utils";

function makeEvent(overrides: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    id: "e1",
    title: "Event 1",
    description: "",
    event_type: "operational",
    scheduled_pt_ms: 0,
    duration_ms: 30_000,
    dependencies: [],
    triggered_issues: [],
    lifecycle: "scheduled",
    started_at_pt_ms: null,
    completed_at_pt_ms: null,
    target_roles: [],
    role_descriptions: {},
    system_effects: [],
    ...overrides,
  };
}

function makeIssue(overrides: Partial<IssueSnapshot> = {}): IssueSnapshot {
  return {
    id: "i1",
    title: "Issue 1",
    description: "",
    trigger_mode: "manual",
    auto_resolve_ms: 0,
    lifecycle: "inactive",
    activated_at_pt_ms: null,
    resolved_at_pt_ms: null,
    released: false,
    ...overrides,
  };
}

describe("timeline-utils", () => {
  describe("computeTimelineItems", () => {
    it("returns empty arrays when no events or issues", () => {
      const result = computeTimelineItems([], [], 0);
      expect(result.eventItems).toEqual([]);
      expect(result.issueItems).toEqual([]);
    });

    it("maps a scheduled event to a timeline item", () => {
      const events = [
        makeEvent({ id: "e1", scheduled_pt_ms: 5000, duration_ms: 10_000 }),
      ];
      const { eventItems } = computeTimelineItems(events, [], 0);
      expect(eventItems).toHaveLength(1);
      expect(eventItems[0].id).toBe("e1");
      expect(eventItems[0].startMs).toBe(5000);
      expect(eventItems[0].endMs).toBe(15_000);
      expect(eventItems[0].kind).toBe("event");
    });

    it("uses started_at_pt_ms when event is running", () => {
      const events = [
        makeEvent({
          id: "e1",
          scheduled_pt_ms: 5000,
          duration_ms: 10_000,
          lifecycle: "running",
          started_at_pt_ms: 6000,
        }),
      ];
      const { eventItems } = computeTimelineItems(events, [], 20_000);
      expect(eventItems[0].startMs).toBe(6000);
      expect(eventItems[0].endMs).toBe(16_000);
    });

    it("uses completed_at_pt_ms for completed events", () => {
      const events = [
        makeEvent({
          id: "e1",
          lifecycle: "completed",
          started_at_pt_ms: 1000,
          completed_at_pt_ms: 8000,
        }),
      ];
      const { eventItems } = computeTimelineItems(events, [], 10_000);
      expect(eventItems[0].startMs).toBe(1000);
      expect(eventItems[0].endMs).toBe(8000);
    });

    it("uses playTimeMs as endMs for running events with no duration", () => {
      const events = [
        makeEvent({
          id: "e1",
          lifecycle: "running",
          duration_ms: null,
          started_at_pt_ms: 1000,
        }),
      ];
      const { eventItems } = computeTimelineItems(events, [], 50_000);
      expect(eventItems[0].endMs).toBe(50_000);
    });

    it("uses default 30s width for scheduled events with no duration", () => {
      const events = [
        makeEvent({
          id: "e1",
          lifecycle: "scheduled",
          duration_ms: null,
          scheduled_pt_ms: 2000,
        }),
      ];
      const { eventItems } = computeTimelineItems(events, [], 0);
      expect(eventItems[0].endMs).toBe(32_000);
    });

    it("filters out issues with no activated_at_pt_ms", () => {
      const issues = [makeIssue({ id: "i1", activated_at_pt_ms: null })];
      const { issueItems } = computeTimelineItems([], issues, 0);
      expect(issueItems).toHaveLength(0);
    });

    it("maps an active issue to a timeline item", () => {
      const issues = [
        makeIssue({
          id: "i1",
          lifecycle: "active",
          activated_at_pt_ms: 3000,
          auto_resolve_ms: 20_000,
        }),
      ];
      const { issueItems } = computeTimelineItems([], issues, 10_000);
      expect(issueItems).toHaveLength(1);
      expect(issueItems[0].startMs).toBe(3000);
      expect(issueItems[0].endMs).toBe(23_000);
      expect(issueItems[0].kind).toBe("issue");
    });

    it("uses resolved_at_pt_ms for resolved issues", () => {
      const issues = [
        makeIssue({
          id: "i1",
          lifecycle: "resolved",
          activated_at_pt_ms: 1000,
          resolved_at_pt_ms: 5000,
        }),
      ];
      const { issueItems } = computeTimelineItems([], issues, 10_000);
      expect(issueItems[0].endMs).toBe(5000);
    });

    it("uses playTimeMs for active issues with no auto_resolve", () => {
      const issues = [
        makeIssue({
          id: "i1",
          lifecycle: "active",
          activated_at_pt_ms: 2000,
          auto_resolve_ms: 0,
        }),
      ];
      const { issueItems } = computeTimelineItems([], issues, 15_000);
      expect(issueItems[0].endMs).toBe(15_000);
    });
  });

  describe("assignLanes", () => {
    it("assigns all non-overlapping items to lane 0", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 100,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "b",
          label: "B",
          startMs: 100,
          endMs: 200,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "c",
          label: "C",
          startMs: 200,
          endMs: 300,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const result = assignLanes(items);
      expect(result.every((i) => i.lane === 0)).toBe(true);
    });

    it("stacks overlapping items into separate lanes", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 200,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "b",
          label: "B",
          startMs: 50,
          endMs: 150,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "c",
          label: "C",
          startMs: 100,
          endMs: 250,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const result = assignLanes(items);
      const lanes = result.map((i) => i.lane);
      expect(lanes).toContain(0);
      expect(lanes).toContain(1);
      expect(Math.max(...lanes)).toBeGreaterThanOrEqual(1);
    });

    it("reuses lanes when items no longer overlap", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 100,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "b",
          label: "B",
          startMs: 50,
          endMs: 150,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
        {
          id: "c",
          label: "C",
          startMs: 150,
          endMs: 200,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const result = assignLanes(items);
      // 'c' starts at 150, 'a' ends at 100, so 'c' can reuse lane 0
      const cItem = result.find((i) => i.id === "c")!;
      expect(cItem.lane).toBe(0);
    });

    it("handles empty input", () => {
      expect(assignLanes([])).toEqual([]);
    });
  });

  describe("computeTimeScale", () => {
    it("returns reasonable scale for empty items", () => {
      const scale = computeTimeScale([], 60_000, 1200);
      expect(scale.totalMs).toBe(60_000);
      expect(scale.pxPerMs).toBeCloseTo(1200 / 60_000);
    });

    it("uses 110% of max end time with items", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 100_000,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const scale = computeTimeScale(items, 50_000, 1200);
      expect(scale.totalMs).toBeCloseTo(110_000);
    });

    it("uses playTimeMs if it exceeds all item ends", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 10_000,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const scale = computeTimeScale(items, 200_000, 1200);
      expect(scale.totalMs).toBeCloseTo(220_000);
    });

    it("returns valid pxPerMs ratio", () => {
      const items: TimelineItem[] = [
        {
          id: "a",
          label: "A",
          startMs: 0,
          endMs: 60_000,
          lifecycle: "",
          kind: "event",
          lane: 0,
        },
      ];
      const scale = computeTimeScale(items, 60_000, 1200);
      expect(scale.pxPerMs).toBeGreaterThan(0);
      expect(scale.pxPerMs * scale.totalMs).toBeCloseTo(1200);
    });
  });
});
