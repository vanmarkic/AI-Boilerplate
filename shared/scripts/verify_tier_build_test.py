"""Tests for verify-tier-build.py.

Uses tmp_path to create isolated fake feature directories, then asserts that
each verification function catches (or allows) the expected patterns.
"""
import textwrap
from pathlib import Path

import pytest

# Import the module under test — adjust sys.path so the import works
# regardless of working directory.
import importlib.util
import sys

_SCRIPT = Path(__file__).resolve().parent / "verify-tier-build.py"
_spec = importlib.util.spec_from_file_location("verify_tier_build", _SCRIPT)
vtb = importlib.util.module_from_spec(_spec)
sys.modules["verify_tier_build"] = vtb
_spec.loader.exec_module(vtb)


# ── Helpers ──────────────────────────────────────────────────


def _make_feature(base: Path, name: str, tier: int, extra_files: dict[str, str] | None = None) -> Path:
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
        features = {"health": 1, "user": 1, "analytics": 2, "ml": 3}
        assert vtb._excluded_names(features, 1) == {"analytics", "ml"}
        assert vtb._excluded_names(features, 2) == {"ml"}
        assert vtb._excluded_names(features, 3) == set()

    def test_included_filters_at_or_below_tier(self) -> None:
        features = {"health": 1, "analytics": 2, "ml": 3}
        assert vtb._included_names(features, 1) == {"health"}
        assert vtb._included_names(features, 2) == {"health", "analytics"}


# ── verify_included_tiers ────────────────────────────────────


class TestVerifyIncludedTiers:
    def test_clean_tier1_build_passes(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1)
        _make_feature(tmp_path, "user", tier=1)
        violations = vtb.verify_included_tiers(tmp_path, max_tier=1, kind="test")
        assert violations == []

    def test_detects_tier2_in_tier1_build(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1)
        _make_feature(tmp_path, "analytics", tier=2)
        violations = vtb.verify_included_tiers(tmp_path, max_tier=1, kind="test")
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "tier 2" in violations[0]

    def test_nonexistent_dest_returns_empty(self, tmp_path: Path) -> None:
        violations = vtb.verify_included_tiers(tmp_path / "nope", 1, "test")
        assert violations == []


# ── verify_filtered_output (_scan_files_for_refs) ────────────


class TestVerifyFilteredOutput:
    def test_no_violations_when_clean(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1, extra_files={
            "health_router.py": "from core.config import settings\n",
        })
        violations = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert violations == []

    def test_detects_excluded_name_in_python_file(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "health", tier=1, extra_files={
            "health_service.py": "from features.analytics.service import AnalyticsService\n",
        })
        violations = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_detects_excluded_name_in_ts_file(self, tmp_path: Path) -> None:
        _make_feature(tmp_path, "dashboard", tier=1, extra_files={
            "dashboard.component.ts": "import { AnalyticsModule } from '../analytics/analytics.module';\n",
        })
        violations = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert len(violations) == 1

    def test_ignores_non_text_files(self, tmp_path: Path) -> None:
        feat = _make_feature(tmp_path, "health", tier=1)
        (feat / "binary.bin").write_bytes(b"\x00analytics\x00")
        violations = vtb.verify_filtered_output(tmp_path, {"analytics"}, "test")
        assert violations == []

    def test_word_boundary_prevents_false_positives(self, tmp_path: Path) -> None:
        """'user' should not match 'user-profile' as a whole-word boundary hit
        when the excluded name is 'user-profile'."""
        _make_feature(tmp_path, "auth", tier=1, extra_files={
            "auth.py": "# manage user sessions\n",
        })
        violations = vtb.verify_filtered_output(tmp_path, {"user-profile"}, "test")
        assert violations == []


# ── verify_backend_entrypoint ────────────────────────────────


class TestVerifyBackendEntrypoint:
    def test_clean_main_passes(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        main_py = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.user.user_router import router as user_router
        """))
        monkeypatch.setattr(vtb, "BACKEND_MAIN", main_py)
        violations = vtb.verify_backend_entrypoint({"analytics", "ml"})
        assert violations == []

    def test_detects_excluded_import(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        main_py = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        monkeypatch.setattr(vtb, "BACKEND_MAIN", main_py)
        violations = vtb.verify_backend_entrypoint({"analytics"})
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "main.py:2" in violations[0]

    def test_missing_main_returns_empty(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(vtb, "BACKEND_MAIN", tmp_path / "nope.py")
        violations = vtb.verify_backend_entrypoint({"analytics"})
        assert violations == []


# ── verify_frontend_routes ───────────────────────────────────


class TestVerifyFrontendRoutes:
    def test_clean_routes_pass(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        routes = tmp_path / "app.routes.ts"
        routes.write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const routes: Routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'register', loadChildren: () => import('./features/register/register.routes').then(m => m.REGISTER_ROUTES) },
            ];
        """))
        monkeypatch.setattr(vtb, "FRONTEND_ROUTES", routes)
        violations = vtb.verify_frontend_routes({"analytics", "ml"})
        assert violations == []

    def test_detects_excluded_route(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        routes = tmp_path / "app.routes.ts"
        routes.write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const routes: Routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'analytics', loadChildren: () => import('./features/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES) },
            ];
        """))
        monkeypatch.setattr(vtb, "FRONTEND_ROUTES", routes)
        violations = vtb.verify_frontend_routes({"analytics"})
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "app.routes.ts:4" in violations[0]

    def test_missing_routes_file_returns_empty(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(vtb, "FRONTEND_ROUTES", tmp_path / "nope.ts")
        violations = vtb.verify_frontend_routes({"analytics"})
        assert violations == []


# ── verify_core_no_feature_imports ───────────────────────────


class TestVerifyCoreNoFeatureImports:
    def test_clean_core_passes(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        core = tmp_path / "core"
        core.mkdir()
        (core / "config.py").write_text("DATABASE_URL = 'sqlite://'\n")
        monkeypatch.setattr(vtb, "BACKEND_CORE", core)
        monkeypatch.setattr(vtb, "FRONTEND_SHARED", tmp_path / "nope")
        violations = vtb.verify_core_no_feature_imports({"analytics"})
        assert violations == []

    def test_detects_backend_core_importing_excluded_feature(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        core = tmp_path / "core"
        core.mkdir()
        (core / "deps.py").write_text("from features.analytics.service import AnalyticsService\n")
        monkeypatch.setattr(vtb, "BACKEND_CORE", core)
        monkeypatch.setattr(vtb, "FRONTEND_SHARED", tmp_path / "nope")
        violations = vtb.verify_core_no_feature_imports({"analytics"})
        assert len(violations) == 1
        assert "core/deps.py" in violations[0]

    def test_detects_frontend_shared_importing_excluded_feature(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(vtb, "BACKEND_CORE", tmp_path / "nope")
        shared = tmp_path / "shared"
        shared.mkdir()
        (shared / "helper.ts").write_text(
            "import { Foo } from '../../features/analytics/analytics.service';\n"
        )
        monkeypatch.setattr(vtb, "FRONTEND_SHARED", shared)
        violations = vtb.verify_core_no_feature_imports({"analytics"})
        assert len(violations) == 1
        assert "shared/helper.ts" in violations[0]

    def test_allows_included_feature_import_in_core(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        core = tmp_path / "core"
        core.mkdir()
        (core / "deps.py").write_text("from features.user.user_service import UserService\n")
        monkeypatch.setattr(vtb, "BACKEND_CORE", core)
        monkeypatch.setattr(vtb, "FRONTEND_SHARED", tmp_path / "nope")
        # 'user' is not in excluded set, so no violation
        violations = vtb.verify_core_no_feature_imports({"analytics"})
        assert violations == []


# ── verify_backend_generated_init ────────────────────────────


class TestVerifyBackendGeneratedInit:
    def test_clean_init_passes(self, tmp_path: Path) -> None:
        (tmp_path / "__init__.py").write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.user.user_router import router as user_router
            def register_features(app):
                app.include_router(health_router)
                app.include_router(user_router)
        """))
        violations = vtb.verify_backend_generated_init(tmp_path, {"health", "user"})
        assert violations == []

    def test_detects_non_included_feature(self, tmp_path: Path) -> None:
        (tmp_path / "__init__.py").write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        violations = vtb.verify_backend_generated_init(tmp_path, {"health"})
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_no_init_file_returns_empty(self, tmp_path: Path) -> None:
        violations = vtb.verify_backend_generated_init(tmp_path, {"health"})
        assert violations == []


# ── verify_frontend_generated_routes ─────────────────────────


class TestVerifyFrontendGeneratedRoutes:
    def test_clean_generated_routes_passes(self, tmp_path: Path) -> None:
        dest = tmp_path / "features"
        dest.mkdir()
        (tmp_path / "app.routes.generated.ts").write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const generatedRoutes: Routes = [
              { path: 'landing', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'register', loadChildren: () => import('./features/register/register.routes').then(m => m.REGISTER_ROUTES) },
            ];
        """))
        violations = vtb.verify_frontend_generated_routes(dest, {"landing", "register"})
        assert violations == []

    def test_detects_non_included_feature_in_generated_routes(self, tmp_path: Path) -> None:
        dest = tmp_path / "features"
        dest.mkdir()
        (tmp_path / "app.routes.generated.ts").write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const generatedRoutes: Routes = [
              { path: 'analytics', loadChildren: () => import('./features/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES) },
            ];
        """))
        violations = vtb.verify_frontend_generated_routes(dest, {"landing"})
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_no_generated_file_returns_empty(self, tmp_path: Path) -> None:
        dest = tmp_path / "features"
        dest.mkdir()
        violations = vtb.verify_frontend_generated_routes(dest, {"landing"})
        assert violations == []


# ── Integration: full pipeline with fake tier-2 feature ──────


class TestIntegrationFakeTier2:
    """Simulates adding a tier-2 feature and verifying a tier-1 build catches it."""

    @pytest.fixture()
    def fake_repo(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Path]:
        # Backend features
        be_all = tmp_path / "all_backend"
        _make_feature(be_all, "health", tier=1)
        _make_feature(be_all, "user", tier=1)
        _make_feature(be_all, "analytics", tier=2)

        # Filtered backend (tier-1 only)
        be_dest = tmp_path / "filtered_backend"
        _make_feature(be_dest, "health", tier=1)
        _make_feature(be_dest, "user", tier=1)

        # Frontend features
        fe_all = tmp_path / "all_frontend"
        _make_feature(fe_all, "landing", tier=1)
        _make_feature(fe_all, "register", tier=1)
        _make_feature(fe_all, "analytics-dash", tier=2)

        # Filtered frontend (tier-1 only)
        fe_dest = tmp_path / "filtered_frontend"
        _make_feature(fe_dest, "landing", tier=1)
        _make_feature(fe_dest, "register", tier=1)

        # Clean main.py
        main_py = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.user.user_router import router as user_router
        """))

        # Clean app.routes.ts
        routes_ts = tmp_path / "app.routes.ts"
        routes_ts.write_text(textwrap.dedent("""\
            export const routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes') },
              { path: 'register', loadChildren: () => import('./features/register/register.routes') },
            ];
        """))

        # Empty core/shared dirs
        core = tmp_path / "core"
        core.mkdir()
        (core / "config.py").write_text("DB = 'sqlite://'\n")
        shared = tmp_path / "shared"
        shared.mkdir()
        (shared / "util.ts").write_text("export const VERSION = '0.1';\n")

        monkeypatch.setattr(vtb, "BACKEND_ALL", be_all)
        monkeypatch.setattr(vtb, "FRONTEND_ALL", fe_all)
        monkeypatch.setattr(vtb, "BACKEND_MAIN", main_py)
        monkeypatch.setattr(vtb, "FRONTEND_ROUTES", routes_ts)
        monkeypatch.setattr(vtb, "BACKEND_CORE", core)
        monkeypatch.setattr(vtb, "FRONTEND_SHARED", shared)

        return {"be_dest": be_dest, "fe_dest": fe_dest, "be_all": be_all, "fe_all": fe_all}

    def test_clean_tier1_build_passes_all_checks(self, fake_repo: dict[str, Path]) -> None:
        """A properly filtered tier-1 build with clean entrypoints passes."""
        be = fake_repo["be_dest"]
        fe = fake_repo["fe_dest"]

        all_be = vtb._feature_names(fake_repo["be_all"])
        all_fe = vtb._feature_names(fake_repo["fe_all"])

        excluded_be = vtb._excluded_names(all_be, 1)
        excluded_fe = vtb._excluded_names(all_fe, 1)
        included_be = vtb._included_names(all_be, 1)
        included_fe = vtb._included_names(all_fe, 1)

        assert excluded_be == {"analytics"}
        assert excluded_fe == {"analytics-dash"}

        # All 10 checks should pass
        assert vtb.verify_included_tiers(be, 1, "backend") == []
        assert vtb.verify_filtered_output(be, excluded_be, "backend") == []
        assert vtb.verify_backend_entrypoint(excluded_be) == []
        assert vtb.verify_core_no_feature_imports(excluded_be) == []
        assert vtb.verify_backend_generated_init(be, included_be) == []

        assert vtb.verify_included_tiers(fe, 1, "frontend") == []
        assert vtb.verify_filtered_output(fe, excluded_fe, "frontend") == []
        assert vtb.verify_frontend_routes(excluded_fe) == []
        assert vtb.verify_core_no_feature_imports(excluded_fe) == []
        assert vtb.verify_frontend_generated_routes(fe, included_fe) == []

    def test_tier2_dir_leaked_into_build_is_caught(self, fake_repo: dict[str, Path]) -> None:
        """If filter-features.py fails and a tier-2 dir leaks through."""
        be = fake_repo["be_dest"]
        _make_feature(be, "analytics", tier=2)
        violations = vtb.verify_included_tiers(be, 1, "backend")
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_main_py_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path], monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """If someone adds `from features.analytics...` to main.py."""
        main_py = vtb.BACKEND_MAIN
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        violations = vtb.verify_backend_entrypoint({"analytics"})
        assert len(violations) == 1

    def test_routes_ts_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path]
    ) -> None:
        """If someone adds a tier-2 route to app.routes.ts."""
        vtb.FRONTEND_ROUTES.write_text(textwrap.dedent("""\
            export const routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes') },
              { path: 'analytics-dash', loadChildren: () => import('./features/analytics-dash/analytics-dash.routes') },
            ];
        """))
        violations = vtb.verify_frontend_routes({"analytics-dash"})
        assert len(violations) == 1

    def test_core_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path]
    ) -> None:
        """If backend/core/ imports a tier-2 feature module."""
        (vtb.BACKEND_CORE / "deps.py").write_text(
            "from features.analytics.service import AnalyticsService\n"
        )
        violations = vtb.verify_core_no_feature_imports({"analytics"})
        assert len(violations) == 1

    def test_shared_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path]
    ) -> None:
        """If frontend/shared/ imports a tier-2 feature path."""
        (vtb.FRONTEND_SHARED / "helper.ts").write_text(
            "import { X } from '../../features/analytics-dash/service';\n"
        )
        violations = vtb.verify_core_no_feature_imports({"analytics-dash"})
        assert len(violations) == 1

    def test_filtered_output_referencing_excluded_name_is_caught(
        self, fake_repo: dict[str, Path]
    ) -> None:
        """If a tier-1 file in the filtered output references an excluded feature."""
        health = fake_repo["be_dest"] / "health"
        (health / "health_service.py").write_text(
            "# TODO: integrate analytics for health metrics\n"
        )
        violations = vtb.verify_filtered_output(
            fake_repo["be_dest"], {"analytics"}, "backend"
        )
        assert len(violations) == 1
