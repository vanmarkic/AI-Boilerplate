"""Observable canonicalisation and extraction."""

import pytest

from domain.observable_entity import Observable, ObservableType
from domain.observable_policy import (
    canonicalize,
    defang,
    extract_observables,
    parse_observable,
    refang,
    require_observable,
)
from domain.soc_error import InvalidIndicatorError


class TestRefangDefang:
    """Defanged artefacts round-trip back to their real form."""

    @pytest.mark.parametrize(
        ("defanged", "expected"),
        [
            ("evil[.]com", "evil.com"),
            ("hxxp://evil.com", "http://evil.com"),
            ("hxxps://evil.com", "https://evil.com"),
            ("user[@]evil[.]com", "user@evil.com"),
            ("1[.]2[.]3[.]4", "1.2.3.4"),
        ],
    )
    def test_refang_restores_original(self, defanged: str, expected: str) -> None:
        assert refang(defanged) == expected

    @pytest.mark.parametrize(
        "original",
        ["evil.com", "http://evil.com/a", "https://evil.com", "1.2.3.4"],
    )
    def test_defang_then_refang_is_identity(self, original: str) -> None:
        assert refang(defang(original)) == original


class TestCanonicalize:
    """Canonical form is what makes deduplication work."""

    @pytest.mark.parametrize(
        ("observable_type", "raw", "expected"),
        [
            (ObservableType.DOMAIN, "EVIL.COM.", "evil.com"),
            (ObservableType.DOMAIN, "  evil[.]com  ", "evil.com"),
            (ObservableType.SHA256, "A" * 64, "a" * 64),
            (ObservableType.EMAIL, "User@Evil.COM", "user@evil.com"),
            (ObservableType.IPV4, " 1.2.3.4 ", "1.2.3.4"),
        ],
    )
    def test_canonical_forms(
        self, observable_type: ObservableType, raw: str, expected: str
    ) -> None:
        assert canonicalize(observable_type, raw) == expected

    def test_url_host_lowercased_but_path_preserved(self) -> None:
        """URL paths are case-sensitive; hosts are not."""
        assert canonicalize(ObservableType.URL, "HTTP://EVIL.COM/PaTh") == "http://evil.com/PaTh"


class TestParseObservable:
    """Malformed values are rejected rather than silently stored."""

    @pytest.mark.parametrize(
        ("observable_type", "value"),
        [
            (ObservableType.IPV4, "1.2.3.4"),
            (ObservableType.IPV6, "2001:db8::1"),
            (ObservableType.DOMAIN, "sub.evil.com"),
            (ObservableType.MD5, "d" * 32),
            (ObservableType.SHA1, "a" * 40),
            (ObservableType.SHA256, "b" * 64),
            (ObservableType.EMAIL, "a@b.co"),
            (ObservableType.URL, "https://evil.com/x"),
        ],
    )
    def test_valid_values_parse(self, observable_type: ObservableType, value: str) -> None:
        parsed = parse_observable(observable_type, value)
        assert parsed == Observable(type=observable_type, value=value)

    @pytest.mark.parametrize(
        ("observable_type", "value"),
        [
            (ObservableType.IPV4, "999.1.1.1"),
            (ObservableType.IPV4, "1.2.3"),
            (ObservableType.IPV4, "2001:db8::1"),
            (ObservableType.IPV6, "1.2.3.4"),
            (ObservableType.MD5, "d" * 31),
            (ObservableType.MD5, "z" * 32),
            (ObservableType.SHA256, "b" * 40),
            (ObservableType.DOMAIN, "nodot"),
            (ObservableType.EMAIL, "not-an-email"),
            (ObservableType.URL, "ftp://evil.com"),
            (ObservableType.DOMAIN, ""),
        ],
    )
    def test_malformed_values_return_none(
        self, observable_type: ObservableType, value: str
    ) -> None:
        assert parse_observable(observable_type, value) is None

    def test_require_observable_raises_on_malformed(self) -> None:
        with pytest.raises(InvalidIndicatorError):
            require_observable(ObservableType.IPV4, "999.1.1.1")


class TestExtractObservables:
    """Free-text extraction is deduplicated and stably ordered."""

    def test_extracts_each_type(self) -> None:
        text = f"conn to 1.2.3.4 via https://evil.com/drop from user@bad.org hash {'a' * 64}"
        found = extract_observables(text)
        by_type = {o.type: o.value for o in found}
        assert by_type[ObservableType.IPV4] == "1.2.3.4"
        assert by_type[ObservableType.URL] == "https://evil.com/drop"
        assert by_type[ObservableType.EMAIL] == "user@bad.org"
        assert by_type[ObservableType.SHA256] == "a" * 64

    def test_extracts_domain_of_a_url_as_well(self) -> None:
        """A URL's host is worth looking up on its own, so both are emitted."""
        found = extract_observables("see https://evil.com/drop")
        assert Observable(ObservableType.URL, "https://evil.com/drop") in found
        assert Observable(ObservableType.DOMAIN, "evil.com") in found

    def test_deduplicates_repeats(self) -> None:
        found = extract_observables("1.2.3.4 and again 1.2.3.4")
        ips = [o for o in found if o.type is ObservableType.IPV4]
        assert len(ips) == 1

    def test_handles_defanged_input(self) -> None:
        found = extract_observables("beacon to evil[.]com over hxxps://evil[.]com/c2")
        assert Observable(ObservableType.DOMAIN, "evil.com") in found
        assert Observable(ObservableType.URL, "https://evil.com/c2") in found

    @pytest.mark.parametrize(
        ("digest", "expected_type"),
        [
            ("a" * 32, ObservableType.MD5),
            ("b" * 40, ObservableType.SHA1),
            ("c" * 64, ObservableType.SHA256),
        ],
    )
    def test_hash_length_selects_type(self, digest: str, expected_type: ObservableType) -> None:
        found = extract_observables(f"dropped {digest} on disk")
        assert Observable(expected_type, digest) in found

    def test_invalid_ip_is_not_extracted(self) -> None:
        found = extract_observables("bogus 999.999.999.999 here")
        assert not [o for o in found if o.type is ObservableType.IPV4]

    def test_empty_text_yields_nothing(self) -> None:
        assert extract_observables("") == ()
