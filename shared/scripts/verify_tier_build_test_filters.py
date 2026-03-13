"""Tests for verify_included_tiers, verify_filtered_output, and verify_backend_entrypoint.

Uses tmp_path to create isolated fake feature directories, then asserts that
each verification function catches (or allows) the expected patterns.
"""
import textwrap
from pathlib import Path

import pytest

from monorepo_tier_filter import verify_tier_build as vtb


# ── Helpers ──────────────────────────────────────────────────


def _make_feature(
    base: Path,
    name: str,
    tier: int,
    extra_files: dict[str, str] | None = None,
) -> Path:
    """Create a fake feature dir with a manifest.yaml and optional extra files."""
    d = base / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "manifest.yaml").write_text(f"name: {name}\ntier: {tier}\n")
    for fname, content in (extra_files or {}).items():
        (d / fname).write_text(content)
    return d


# ── verify_included_tiers ────────────────────────────────────


class TestVerifyIncludedTiers:
    def test_clean_tier1_build_passes(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1)
        _make_feature(tmp_path, "user", tier=1)
        violations: list[str] = vtb.verify_included_tiers(tmp_path, max_tier=1, kind="test")
        assert violations == []

    def test_detects_tier2_in_tier1_build(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1)
        _make_feature(tmp_path, "analytics", tier=2)
        violations: list[str] = vtb.verify_included_tiers(tmp_path, max_tier=1, kind="test")
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "tier 2" in violations[0]

    def test_nonexistent_dest_returns_empty(self, tmp_path: Path) -> None:
        violations: list[str] = vtb.verify_included_tiers(tmp_path / "nope", 1, "test")
        assert violations == []


# ── verify_filtered_output (_scan_files_for_refs) ────────────


class TestVerifyFilteredOutput:
    def test_no_violations_when_clean(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1, extra_files={
            "health_router.py": "from core.config import settings\n",
        })
        violations: list[str] = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert violations == []

    def test_detects_excluded_name_in_python_file(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1, extra_files={
            "health_service.py": "from features.analytics.service import AnalyticsService\n",
        })
        violations: list[str] = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_detects_excluded_name_in_ts_file(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "dashboard", tier=1, extra_files={
            "dashboard.component.ts": "import { AnalyticsModule } from '../analytics/analytics.module';\n",
        })
        violations: list[str] = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert len(violations) == 1

    def test_ignores_non_text_files(self, tmp_path: Path) -> None:
        feat: Path = _make_feature(tmp_path, "health", tier=1)
        (feat / "binary.bin").write_bytes(b"\x00analytics\x00")
        violations: list[str] = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert violations == []

    def test_word_boundary_prevents_false_positives(self, tmp_path: Path) -> None:
        """'user' should not match 'user-profile' as a whole-word boundary hit
        when the excluded name is 'user-profile'."""
        _make_feature(tmp_path, "auth", tier=1, extra_files={
            "auth.py": "# manage user sessions\n",
        })
        violations: list[str] = vtb.verify_filtered_output(tmp_path, {"user-profile"}, "test")
        assert violations == []


# ── verify_backend_entrypoint ────────────────────────────────


class TestVerifyBackendEntrypoint:
    def test_clean_main_passes(self, tmp_path: Path) -> None:
        main_py: Path = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.user.user_router import router as user_router
        """))
        violations: list[str] = vtb.verify_backend_entrypoint(main_py, {"analytics", "ml"})
        assert violations == []

    def test_detects_excluded_import(self, tmp_path: Path) -> None:
        main_py: Path = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        violations: list[str] = vtb.verify_backend_entrypoint(main_py, {"analytics"})
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "main.py:2" in violations[0]

    def test_detects_multi_import_on_single_line(self, tmp_path: Path) -> None:
        """import features.health, features.analytics on one line."""
        main_py: Path = tmp_path / "main.py"
        main_py.write_text("import features.health, features.analytics\n")
        violations: list[str] = vtb.verify_backend_entrypoint(main_py, {"analytics"})
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_multi_import_catches_both_excluded(self, tmp_path: Path) -> None:
        main_py: Path = tmp_path / "main.py"
        main_py.write_text("import features.analytics, features.ml\n")
        violations: list[str] = vtb.verify_backend_entrypoint(main_py, {"analytics", "ml"})
        assert len(violations) == 2

    def test_missing_main_returns_empty(self, tmp_path: Path) -> None:
        violations: list[str] = vtb.verify_backend_entrypoint(tmp_path / "nope.py", {"analytics"})
        assert violations == []
