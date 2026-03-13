"""Tests for _read_tier, _feature_names, and _excluded/_included_names.

Uses tmp_path to create isolated fake feature directories, then asserts that
each verification function catches (or allows) the expected patterns.
"""
from pathlib import Path


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


def _make_feature_no_manifest(base: Path, name: str) -> Path:
    """Feature without manifest — defaults to tier 1."""
    d = base / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "placeholder.py").write_text("# placeholder\n")
    return d


# ── _read_tier ───────────────────────────────────────────────


class TestReadTier:
    def test_missing_manifest_defaults_to_1(self, tmp_path: Path) -> None:
        d = tmp_path / "feat"
        d.mkdir()
        assert vtb._read_tier(d) == 1

    def test_reads_tier_from_manifest(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "premium", tier=3)
        assert vtb._read_tier(tmp_path / "premium") == 3

    def test_manifest_without_tier_key_defaults_to_1(self, tmp_path: Path) -> None:
        d = tmp_path / "feat"
        d.mkdir()
        (d / "manifest.yaml").write_text("name: feat\n")
        assert vtb._read_tier(d) == 1

    def test_empty_manifest_defaults_to_1(self, tmp_path: Path) -> None:
        d = tmp_path / "feat"
        d.mkdir()
        (d / "manifest.yaml").write_text("")
        assert vtb._read_tier(d) == 1

    def test_non_mapping_manifest_defaults_to_1(self, tmp_path: Path) -> None:
        d = tmp_path / "feat"
        d.mkdir()
        (d / "manifest.yaml").write_text("- just\n- a\n- list\n")
        assert vtb._read_tier(d) == 1

    def test_invalid_yaml_defaults_to_1(self, tmp_path: Path) -> None:
        d = tmp_path / "feat"
        d.mkdir()
        (d / "manifest.yaml").write_text(": : :\nbad yaml {{{\n")
        assert vtb._read_tier(d) == 1


# ── _feature_names ───────────────────────────────────────────


class TestFeatureNames:
    def test_returns_name_tier_mapping(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1)
        _make_feature(tmp_path, "analytics", tier=2)
        result = vtb._feature_names(tmp_path)
        assert result == {"health": 1, "analytics": 2}

    def test_ignores_underscore_prefixed_dirs(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "_internal", tier=1)
        _make_feature(tmp_path, "health", tier=1)
        result = vtb._feature_names(tmp_path)
        assert "_internal" not in result
        assert "health" in result

    def test_nonexistent_dir_returns_empty(self, tmp_path: Path) -> None:
        result = vtb._feature_names(tmp_path / "nope")
        assert result == {}

    def test_no_manifest_defaults_to_1(self, tmp_path: Path) -> None:
        _make_feature_no_manifest(tmp_path, "bare")
        result = vtb._feature_names(tmp_path)
        assert result == {"bare": 1}


# ── _excluded_names / _included_names ────────────────────────


class TestExcludedIncluded:
    def test_excluded_filters_above_tier(self) -> None:
        features: dict[str, int] = {"health": 1, "user": 1, "analytics": 2, "ml": 3}
        assert vtb._excluded_names(features, 1) == {"analytics", "ml"}
        assert vtb._excluded_names(features, 2) == {"ml"}
        assert vtb._excluded_names(features, 3) == set()

    def test_included_filters_at_or_below_tier(self) -> None:
        features: dict[str, int] = {"health": 1, "analytics": 2, "ml": 3}
        assert vtb._included_names(features, 1) == {"health"}
        assert vtb._included_names(features, 2) == {"health", "analytics"}
