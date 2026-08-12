"""Normalizing source-shaped payloads into platform events."""

from datetime import UTC, datetime
from uuid import UUID

from domain.event_entity import AssetCriticality, RawEvent, SourceProfile
from domain.normalization_policy import dedup_key, normalize, read_path
from domain.observable_entity import Observable, ObservableType

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
EVENT_ID = UUID("11111111-1111-1111-1111-111111111111")

PROFILE = SourceProfile(
    source="edr",
    field_map={
        "occurred_at": "event.time",
        "category": "event.category",
        "action": "event.action",
        "message": "event.message",
        "host": "agent.hostname",
        "user": "user.name",
    },
    default_category="uncategorized",
    observable_fields=("network.remote_ip", "process.hash"),
    criticality_by_host={"dc01": AssetCriticality.CROWN_JEWEL},
)


def raw(**overrides: object) -> RawEvent:
    """Build a raw event with a realistic nested payload."""
    payload: dict = {
        "event": {
            "time": "2026-08-12T11:30:00+00:00",
            "category": "malware",
            "action": "process_exec",
            "message": "blocked connection to evil.com",
        },
        "agent": {"hostname": "web01"},
        "user": {"name": "alice"},
        "network": {"remote_ip": "203.0.113.9"},
        "process": {"hash": "a" * 64},
    }
    payload.update(overrides)  # type: ignore[arg-type]
    return RawEvent(source="edr", received_at=NOW, payload=payload, external_id="ext-1")


class TestReadPath:
    """Dotted paths read out of nested payloads."""

    def test_reads_a_nested_value(self) -> None:
        assert read_path({"a": {"b": {"c": 1}}}, "a.b.c") == 1

    def test_missing_path_is_none(self) -> None:
        assert read_path({"a": {}}, "a.b.c") is None

    def test_path_through_a_non_mapping_is_none(self) -> None:
        assert read_path({"a": 5}, "a.b") is None


class TestNormalize:
    """Raw payloads become source-independent events."""

    def test_maps_declared_fields(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert event.category == "malware"
        assert event.action == "process_exec"
        assert event.host == "web01"
        assert event.user == "alice"
        assert event.source == "edr"

    def test_parses_the_source_timestamp(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert event.occurred_at == datetime(2026, 8, 12, 11, 30, tzinfo=UTC)

    def test_unparseable_timestamp_falls_back_to_received_at(self) -> None:
        event = normalize(raw(event={"time": "not-a-date"}), PROFILE, EVENT_ID)
        assert event.occurred_at == NOW

    def test_missing_category_uses_the_profile_default(self) -> None:
        event = normalize(raw(event={}), PROFILE, EVENT_ID)
        assert event.category == "uncategorized"

    def test_extracts_observables_from_declared_fields(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert Observable(ObservableType.IPV4, "203.0.113.9") in event.observables
        assert Observable(ObservableType.SHA256, "a" * 64) in event.observables

    def test_extracts_observables_from_the_message(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert Observable(ObservableType.DOMAIN, "evil.com") in event.observables

    def test_known_host_gets_its_configured_criticality(self) -> None:
        event = normalize(raw(agent={"hostname": "dc01"}), PROFILE, EVENT_ID)
        assert event.asset_criticality is AssetCriticality.CROWN_JEWEL

    def test_unknown_host_defaults_to_standard(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert event.asset_criticality is AssetCriticality.STANDARD

    def test_raw_payload_is_preserved(self) -> None:
        event = normalize(raw(), PROFILE, EVENT_ID)
        assert event.raw["agent"] == {"hostname": "web01"}

    def test_empty_profile_still_produces_an_event(self) -> None:
        """An unconfigured source must degrade, not crash the pipeline."""
        bare = SourceProfile(source="edr", field_map={})
        event = normalize(raw(), bare, EVENT_ID)
        assert event.category == "uncategorized"
        assert event.host is None
        assert event.observables == ()


class TestDedupKey:
    """The same event from the same source is the same event."""

    def test_uses_the_source_identifier_when_present(self) -> None:
        assert dedup_key(raw(), PROFILE) == dedup_key(raw(), PROFILE)

    def test_differs_by_external_id(self) -> None:
        other = RawEvent(source="edr", received_at=NOW, payload={}, external_id="ext-2")
        assert dedup_key(raw(), PROFILE) != dedup_key(other, PROFILE)

    def test_falls_back_to_content_when_there_is_no_identifier(self) -> None:
        a = RawEvent(source="edr", received_at=NOW, payload=raw().payload)
        b = RawEvent(source="edr", received_at=NOW, payload=raw().payload)
        assert dedup_key(a, PROFILE) == dedup_key(b, PROFILE)

    def test_content_fallback_distinguishes_different_hosts(self) -> None:
        payload_a = dict(raw().payload)
        payload_b = dict(raw().payload)
        payload_b["agent"] = {"hostname": "web02"}
        a = RawEvent(source="edr", received_at=NOW, payload=payload_a)
        b = RawEvent(source="edr", received_at=NOW, payload=payload_b)
        assert dedup_key(a, PROFILE) != dedup_key(b, PROFILE)
