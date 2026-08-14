"""Documented environment variable names are the ones the settings bind to.

The provider variables are the vendor-swap mechanism — the platform's central
claim. A variable named in the docs but not bound by ``Settings`` is worse than
a typo: it is silently ignored, so an operator following the instructions gets
the default and no error. That is exactly what happened here, and it is what
this suite exists to stop happening again.
"""

import re
from pathlib import Path

import pytest

from core.config import Settings

BACKEND_ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = BACKEND_ROOT.parent

PROVIDER_FIELDS = (
    "search_provider",
    "threat_intel_provider",
    "case_provider",
    "orchestration_provider",
    "repository_provider",
)

# Any SHOUTING_CASE token ending in _PROVIDER, as it would appear in prose.
# ``*`` is deliberately inside the character class: a glob like ``SOC_*_PROVIDER``
# reads as authoritative and names nothing, which is how the wrong prefix spread
# through four files unnoticed. Documentation has to spell the variables out.
_PROVIDER_MENTION = re.compile(r"(?<![A-Za-z0-9_])[A-Z][A-Z0-9_*]*_PROVIDER(?![A-Za-z0-9_])")


def _env_prefix() -> str:
    """Return the prefix pydantic-settings puts in front of every field name."""
    return str(Settings.model_config.get("env_prefix", "")).upper()


def _bound_names() -> set[str]:
    """Return the environment variable name of every settings field."""
    prefix = _env_prefix()
    return {f"{prefix}{name.upper()}" for name in Settings.model_fields}


def _documentation() -> list[Path]:
    """Return every file that tells a human how to configure this service."""
    files = [
        *APP_ROOT.glob("*.md"),
        *BACKEND_ROOT.glob("*.md"),
        BACKEND_ROOT / ".env.example",
        *(p for p in BACKEND_ROOT.rglob("*.py") if not p.name.endswith("_test.py")),
    ]
    return [path for path in files if path.exists()]


class TestProviderBinding:
    """The swap points respond to the variable names they are documented under."""

    @pytest.mark.parametrize("field", PROVIDER_FIELDS)
    def test_the_bare_field_name_selects_the_provider(
        self, field: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Setting FIELD_NAME=sentinel must reach the setting."""
        monkeypatch.setenv(f"{_env_prefix()}{field.upper()}", "sentinel")
        assert getattr(Settings(_env_file=None), field) == "sentinel"

    @pytest.mark.parametrize("field", PROVIDER_FIELDS)
    def test_an_unbound_prefix_is_silently_ignored(
        self, field: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The failure mode worth naming: a wrong prefix does not raise, it defaults.

        This is not an endorsement of the prefix — it pins *why* documenting the
        wrong name is dangerous rather than merely untidy.
        """
        monkeypatch.setenv(f"WRONG_{field.upper()}", "sentinel")
        assert getattr(Settings(_env_file=None), field) == "memory"


class TestDocumentedNamesExist:
    """No document may name a provider variable the settings do not bind."""

    def test_documentation_is_actually_scanned(self) -> None:
        """Guards the suite against passing because it found nothing to check."""
        mentions = [p for p in _documentation() if _PROVIDER_MENTION.search(p.read_text())]
        assert mentions, "no provider variable found anywhere — the scan is broken"

    def test_every_mentioned_provider_variable_is_bound(self) -> None:
        bound = _bound_names()
        offenders: list[str] = []
        for path in _documentation():
            for name in sorted(set(_PROVIDER_MENTION.findall(path.read_text()))):
                if name not in bound:
                    offenders.append(f"{path.relative_to(APP_ROOT)}: {name}")
        assert not offenders, (
            "these documents name environment variables nothing reads, so following "
            f"them silently does nothing: {offenders}"
        )
