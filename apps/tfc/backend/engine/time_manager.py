"""Manages dual-clock time for exercise sessions.

Real Time (RT): Wall-clock elapsed milliseconds since exercise start.
Play Time (PT): Simulated scenario time, advances by (elapsed_rt * factor).
"""
import time


class TimeManager:
    """Owns the dual RT/PT clock for an exercise session."""

    def __init__(self, factor: float = 1.0) -> None:
        self._factor = factor
        self._paused = True
        self._play_time_ms: float = 0.0
        self._last_tick_real_ms: float = 0.0
        self._start_real_ms: float = 0.0

    @property
    def factor(self) -> float:
        return self._factor

    @factor.setter
    def factor(self, value: float) -> None:
        if value <= 0:
            raise ValueError("Factor must be positive")
        self._factor = value

    @property
    def paused(self) -> bool:
        return self._paused

    @property
    def play_time_ms(self) -> float:
        return self._play_time_ms

    @property
    def real_time_ms(self) -> float:
        if self._start_real_ms == 0:
            return 0.0
        return _now_ms() - self._start_real_ms

    def start(self) -> None:
        """Start or resume the clock."""
        now = _now_ms()
        if self._start_real_ms == 0:
            self._start_real_ms = now
        self._last_tick_real_ms = now
        self._paused = False

    def pause(self) -> None:
        """Pause the clock. Play time stops advancing."""
        if not self._paused:
            self.tick()  # capture any remaining elapsed time
            self._paused = True

    def reset(self) -> None:
        """Reset both clocks to zero."""
        self._play_time_ms = 0.0
        self._start_real_ms = 0.0
        self._last_tick_real_ms = 0.0
        self._paused = True

    def tick(self) -> float:
        """Advance play time based on elapsed real time since last tick.

        Returns the play time delta in milliseconds.
        """
        if self._paused:
            return 0.0
        now = _now_ms()
        elapsed_real = now - self._last_tick_real_ms
        self._last_tick_real_ms = now
        pt_delta = elapsed_real * self._factor
        self._play_time_ms += pt_delta
        return pt_delta

    def snapshot(self) -> dict:
        """Return current time state as a serializable dict."""
        return {
            "play_time_ms": self._play_time_ms,
            "real_time_ms": self.real_time_ms,
            "factor": self._factor,
            "paused": self._paused,
        }


def _now_ms() -> float:
    return time.monotonic() * 1000.0
