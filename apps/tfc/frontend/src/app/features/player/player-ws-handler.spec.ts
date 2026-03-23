import { describe, it, expect, beforeEach, vi } from "vitest";
import { handlePlayerWsMessage } from "./player-ws-handler";

describe("handlePlayerWsMessage", () => {
  let mockStore: any;
  let mockWs: any;

  beforeEach(() => {
    mockStore = {
      applyPhaseChange: vi.fn(),
      applySnapshot: vi.fn(),
      applyTimeUpdate: vi.fn(),
      updateEvent: vi.fn(),
      updateIssue: vi.fn(),
      applyDecisions: vi.fn(),
      decisions: vi.fn().mockReturnValue([]),
      closeDecision: vi.fn(),
      applyScoreChange: vi.fn(),
      applyRecommendation: vi.fn(),
      setSpeedFactor: vi.fn(),
      applySystemChange: vi.fn(),
    };
    mockWs = { disconnect: vi.fn() };
  });

  it("should call applyPhaseChange and disconnect on exercise_stopped reason=completed", () => {
    handlePlayerWsMessage(
      { type: "exercise_stopped", reason: "completed" } as never,
      mockStore as never,
      undefined,
      mockWs as never,
    );
    expect(mockStore["applyPhaseChange"]).toHaveBeenCalledWith("completed");
    expect(mockWs.disconnect).toHaveBeenCalled();
  });

  it("should call applyPhaseChange and disconnect on phase_change completed via state_changes", () => {
    handlePlayerWsMessage(
      {
        type: "state_changes",
        changes: [
          {
            type: "phase_change",
            phase: "completed",
            action: "completed",
            time: {},
          },
        ],
      } as never,
      mockStore as never,
      undefined,
      mockWs as never,
    );
    expect(mockStore["applyPhaseChange"]).toHaveBeenCalledWith("completed");
    expect(mockWs.disconnect).toHaveBeenCalled();
  });

  it("should call onStopped for exercise_stopped with non-completed reason", () => {
    const onStopped = vi.fn();
    handlePlayerWsMessage(
      { type: "exercise_stopped", reason: "stopped_by_gm" } as never,
      mockStore as never,
      onStopped,
      mockWs as never,
    );
    expect(onStopped).toHaveBeenCalled();
    expect(mockStore["applyPhaseChange"]).not.toHaveBeenCalled();
  });

  it("should apply snapshot on snapshot message", () => {
    const snap = { type: "snapshot", phase: "running" };
    handlePlayerWsMessage(snap as never, mockStore as never);
    expect(mockStore["applySnapshot"]).toHaveBeenCalledWith(snap);
  });

  it("should not disconnect on non-completed phase_change", () => {
    handlePlayerWsMessage(
      {
        type: "state_changes",
        changes: [
          { type: "phase_change", phase: "paused", action: "paused", time: {} },
        ],
      } as never,
      mockStore as never,
      undefined,
      mockWs as never,
    );
    expect(mockWs.disconnect).not.toHaveBeenCalled();
  });
});
