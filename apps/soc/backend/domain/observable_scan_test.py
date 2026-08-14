"""Extraction stays cheap on hostile input.

``extract_observables`` runs inside the request path of an async service, on a
``message`` field that comes from whatever a log shipper sent. Regex time that
grows faster than the input is not a slow function — it is one request holding
the event loop, so every other request on the worker waits behind it.

Wall-clock assertions are ordinarily a smell. They are the right tool here
because the property under test *is* time: a bound on how long an untrusted
string may cost. The margins are wide enough (a second, against a budget of
milliseconds) that only an algorithmic regression trips them.
"""

import re
import time

import pytest

from domain.observable_entity import ObservableType
from domain.observable_policy import MAX_SCAN_CHARS, extract_observables

# Hyphens are not word characters, so "\b" matches between every pair. A naive
# label pattern therefore gets O(n) start positions each doing O(n) backtracking.
HOSTILE = "a-" * 32_000  # 64 KB, no observable in it at all

BUDGET_SECONDS = 1.0


def _seconds(text: str) -> float:
    """Return how long one extraction pass takes."""
    started = time.perf_counter()
    extract_observables(text)
    return time.perf_counter() - started


class TestHostileInput:
    """Untrusted text cannot buy unbounded CPU."""

    def test_a_long_hyphenated_run_is_cheap(self) -> None:
        assert _seconds(HOSTILE) < BUDGET_SECONDS

    def test_cost_does_not_grow_faster_than_input(self) -> None:
        """Quadratic blowup shows up as a ratio, independent of machine speed."""
        small = _seconds("a-" * 4_000)
        large = _seconds("a-" * 16_000)  # 4x the input
        floor = 0.002  # keep the ratio meaningful when both are near zero
        assert large / max(small, floor) < 10, (
            f"4x input cost {large / max(small, floor):.1f}x time — superlinear"
        )

    @pytest.mark.parametrize(
        "text",
        [
            "(" * 20_000,
            "." * 20_000,
            "http://" + "a" * 20_000,
            "0" * 20_000,
            "a." * 20_000,
        ],
        ids=["parens", "dots", "long-url", "long-hex", "many-labels"],
    )
    def test_other_pathological_shapes_are_cheap(self, text: str) -> None:
        assert _seconds(text) < BUDGET_SECONDS


class TestScanLimit:
    """Scanning is bounded, and the bound is honest about what it costs."""

    def test_input_beyond_the_limit_is_not_scanned(self) -> None:
        """An artefact past the cap is not extracted — the trade, stated."""
        text = "x " * MAX_SCAN_CHARS + " evil.example"
        assert extract_observables(text) == ()

    def test_input_within_the_limit_is_fully_scanned(self) -> None:
        padding = "x " * 100
        found = extract_observables(f"{padding} evil.example {padding}")
        assert any(o.value == "evil.example" for o in found)

    def test_truncation_does_not_split_a_token(self) -> None:
        """A hard cut mid-token could invent an artefact that was never there.

        ``evil.example`` cut at 8 characters is ``evil.exa`` — still a
        well-formed domain, and a wrong one. Truncation therefore falls back to
        the last whitespace, so a partial token is dropped rather than reported.
        """
        head = "x " * ((MAX_SCAN_CHARS // 2) - 4)
        found = extract_observables(f"{head}evil.example")
        assert all(o.value != "evil.exa" for o in found)

    def test_the_limit_leaves_room_for_a_real_log_line(self) -> None:
        assert MAX_SCAN_CHARS >= 8_192


class TestExtractionStillWorks:
    """The bound did not cost the behaviour the function exists for."""

    def test_finds_each_artefact_type(self) -> None:
        found = extract_observables(
            "conn to 198.51.100.7 for https://evil.example/p from user@corp.example "
            "hash d41d8cd98f00b204e9800998ecf8427e"
        )
        types = {o.type for o in found}
        assert {
            ObservableType.IPV4,
            ObservableType.URL,
            ObservableType.EMAIL,
            ObservableType.DOMAIN,
            ObservableType.MD5,
        } <= types

    def test_a_long_label_is_still_rejected(self) -> None:
        """DNS caps a label at 63 characters; the find pattern must agree.

        Deliberately non-hex: a 64-character run of ``a`` is a well-formed
        SHA-256, and would be extracted as one for entirely correct reasons.
        """
        assert extract_observables(f"{'z' * 64}.example") == ()

    def test_a_maximum_length_label_is_still_found(self) -> None:
        label = "z" * 63
        found = extract_observables(f"see {label}.example here")
        assert any(o.value == f"{label}.example" for o in found)


def test_no_find_pattern_has_an_unbounded_repeat() -> None:
    """The structural guard behind the timings above.

    A wall-clock test says "this input is fast today". This says "no pattern can
    scan an unbounded run", which is the property that made it fast.
    """
    from domain import observable_policy

    # Strip character classes before looking for quantifiers: "+" and "*" are
    # ordinary literals inside one (``[a-z0-9._%+-]``), and counting those as
    # unbounded repeats is how this check cries wolf.
    without_classes = re.compile(r"\[(?:[^]\\]|\\.)*\]")

    patterns = {
        name: value.pattern
        for name, value in vars(observable_policy).items()
        if name.endswith("_FIND_RE") and isinstance(value, re.Pattern)
    }
    assert len(patterns) >= 5, f"only found {sorted(patterns)} — the scan is broken"

    offenders = [
        name
        for name, pattern in patterns.items()
        if re.search(r"[*+]", without_classes.sub("", pattern))
    ]
    assert not offenders, f"unbounded repeat in {offenders} — reintroduces the blowup"
