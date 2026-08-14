"""Every attribute type in the mapping table survives the round trip.

The table is the anti-corruption layer's whole surface: an entry that does not
translate is an indicator the platform never learns about, and nothing raises —
``to_indicator_intel`` returns None so one bad row cannot lose a page. That
design makes a mis-mapping invisible, so the table needs a test that walks all
of it rather than a fixture that exercises one row.
"""

import pytest

from adapters.misp.misp_mapper import ATTRIBUTE_TYPES, to_indicator_intel
from domain.observable_entity import ObservableType

MD5 = "d41d8cd98f00b204e9800998ecf8427e"
SHA1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709"
SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

# A realistic value for each type, in the exact form MISP serialises it.
# Composite types put their two parts in a fixed order that differs by family:
# ip-src|port is artefact-first, filename|hash is artefact-*second*.
SAMPLE_VALUES: dict[str, tuple[str, str]] = {
    "ip-src": ("198.51.100.7", "198.51.100.7"),
    "ip-dst": ("203.0.113.9", "203.0.113.9"),
    "ip-src|port": ("198.51.100.7|443", "198.51.100.7"),
    "ip-dst|port": ("203.0.113.9|8443", "203.0.113.9"),
    "domain": ("evil.example", "evil.example"),
    "hostname": ("host.evil.example", "host.evil.example"),
    "url": ("https://evil.example/payload", "https://evil.example/payload"),
    "md5": (MD5, MD5),
    "sha1": (SHA1, SHA1),
    "sha256": (SHA256, SHA256),
    "filename|md5": (f"evil.exe|{MD5}", MD5),
    "filename|sha1": (f"evil.exe|{SHA1}", SHA1),
    "filename|sha256": (f"evil.exe|{SHA256}", SHA256),
    "email-src": ("attacker@evil.example", "attacker@evil.example"),
    "email-dst": ("victim@corp.example", "victim@corp.example"),
    "filename": ("evil.exe", "evil.exe"),
}


def _attribute(misp_type: str, value: str) -> dict[str, object]:
    """One attribute in the shape /attributes/restSearch returns."""
    return {
        "id": "1",
        "type": misp_type,
        "value": value,
        "to_ids": True,
        "Event": {"threat_level_id": "1", "Tag": [{"name": "tlp:amber"}]},
    }


class TestEveryMappedType:
    """No entry in ATTRIBUTE_TYPES may translate to nothing."""

    def test_the_table_is_covered(self) -> None:
        """A sample per entry, so adding a type without one fails here."""
        assert set(SAMPLE_VALUES) == set(ATTRIBUTE_TYPES)

    @pytest.mark.parametrize(("misp_type", "sample"), sorted(SAMPLE_VALUES.items()))
    def test_translates_to_the_expected_observable(
        self, misp_type: str, sample: tuple[str, str]
    ) -> None:
        raw_value, expected_value = sample
        intel = to_indicator_intel(_attribute(misp_type, raw_value))
        assert intel is not None, f"{misp_type} translated to nothing"
        assert intel.observable.value == expected_value


class TestCompositeTypes:
    """The two composite families read their artefact from opposite sides."""

    @pytest.mark.parametrize(
        ("misp_type", "expected_type"),
        [
            ("filename|md5", ObservableType.MD5),
            ("filename|sha1", ObservableType.SHA1),
            ("filename|sha256", ObservableType.SHA256),
        ],
    )
    def test_a_file_hash_is_read_from_the_second_part(
        self, misp_type: str, expected_type: ObservableType
    ) -> None:
        """MISP formats these as ``filename|hash``, not ``hash|filename``."""
        value = SAMPLE_VALUES[misp_type][0]
        intel = to_indicator_intel(_attribute(misp_type, value))
        assert intel is not None
        assert intel.observable.type is expected_type
        assert intel.observable.value == value.split("|")[1]

    def test_an_address_is_read_from_the_first_part(self) -> None:
        intel = to_indicator_intel(_attribute("ip-dst|port", "203.0.113.9|8443"))
        assert intel is not None
        assert intel.observable.type is ObservableType.IPV4
        assert intel.observable.value == "203.0.113.9"


class TestUntranslatable:
    """Rows we cannot represent are dropped, not guessed at."""

    def test_an_unknown_type_is_dropped(self) -> None:
        assert to_indicator_intel(_attribute("btc", "1A1zP1eP5Q")) is None

    def test_a_malformed_value_is_dropped(self) -> None:
        assert to_indicator_intel(_attribute("md5", "not-a-hash")) is None

    def test_a_composite_missing_its_artefact_is_dropped(self) -> None:
        """``filename|md5`` with no hash half must not fall back to the filename."""
        assert to_indicator_intel(_attribute("filename|md5", "evil.exe")) is None
