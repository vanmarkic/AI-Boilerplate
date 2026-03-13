"""Tests for verify_frontend_routes, verify_core_no_feature_imports,
verify_backend_generated_init, and verify_frontend_generated_routes.

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


# ── verify_frontend_routes ───────────────────────────────────


class TestVerifyFrontendRoutes:
    def test_clean_routes_pass(self, tmp_path: Path) -> None:
        routes: Path = tmp_path / "app.routes.ts"
        routes.write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const routes: Routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'register', loadChildren: () => import('./features/register/register.routes').then(m => m.REGISTER_ROUTES) },
            ];
        """))
        violations: list[str] = vtb.verify_frontend_routes(routes, {"analytics", "ml"})
        assert violations == []

    def test_detects_excluded_route(self, tmp_path: Path) -> None:
        routes: Path = tmp_path / "app.routes.ts"
        routes.write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const routes: Routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'analytics', loadChildren: () => import('./features/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES) },
            ];
        """))
        violations: list[str] = vtb.verify_frontend_routes(routes, {"analytics"})
        assert len(violations) == 1
        assert "analytics" in violations[0]
        assert "app.routes.ts:4" in violations[0]

    def test_missing_routes_file_returns_empty(self, tmp_path: Path) -> None:
        violations: list[str] = vtb.verify_frontend_routes(tmp_path / "nope.ts", {"analytics"})
        assert violations == []


# ── verify_core_no_feature_imports ───────────────────────────


class TestVerifyCoreNoFeatureImports:
    def test_clean_core_passes(self, tmp_path: Path) -> None:
        core: Path = tmp_path / "core"
        core.mkdir()
        (core / "config.py").write_text("DATABASE_URL = 'sqlite://'\n")
        violations: list[str] = vtb.verify_core_no_feature_imports(
            core, tmp_path / "nope", {"analytics"},
        )
        assert violations == []

    def test_detects_backend_core_importing_excluded_feature(
        self, tmp_path: Path,
    ) -> None:
        core: Path = tmp_path / "core"
        core.mkdir()
        (core / "deps.py").write_text(
            "from features.analytics.service import AnalyticsService\n",
        )
        violations: list[str] = vtb.verify_core_no_feature_imports(
            core, tmp_path / "nope", {"analytics"},
        )
        assert len(violations) == 1
        assert "core/deps.py" in violations[0]

    def test_detects_frontend_shared_importing_excluded_feature(
        self, tmp_path: Path,
    ) -> None:
        shared: Path = tmp_path / "shared"
        shared.mkdir()
        (shared / "helper.ts").write_text(
            "import { Foo } from '../../features/analytics/analytics.service';\n",
        )
        violations: list[str] = vtb.verify_core_no_feature_imports(
            tmp_path / "nope", shared, {"analytics"},
        )
        assert len(violations) == 1
        assert "shared/helper.ts" in violations[0]

    def test_detects_multi_import_in_core(
        self, tmp_path: Path,
    ) -> None:
        core: Path = tmp_path / "core"
        core.mkdir()
        (core / "deps.py").write_text("import features.analytics, features.ml\n")
        violations: list[str] = vtb.verify_core_no_feature_imports(
            core, tmp_path / "nope", {"analytics", "ml"},
        )
        assert len(violations) == 2

    def test_allows_included_feature_import_in_core(
        self, tmp_path: Path,
    ) -> None:
        core: Path = tmp_path / "core"
        core.mkdir()
        (core / "deps.py").write_text(
            "from features.user.user_service import UserService\n",
        )
        # 'user' is not in excluded set, so no violation
        violations: list[str] = vtb.verify_core_no_feature_imports(
            core, tmp_path / "nope", {"analytics"},
        )
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
        violations: list[str] = vtb.verify_backend_generated_init(
            tmp_path, {"health", "user"},
        )
        assert violations == []

    def test_detects_non_included_feature(self, tmp_path: Path) -> None:
        (tmp_path / "__init__.py").write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        violations: list[str] = vtb.verify_backend_generated_init(tmp_path, {"health"})
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_no_init_file_returns_empty(self, tmp_path: Path) -> None:
        violations: list[str] = vtb.verify_backend_generated_init(tmp_path, {"health"})
        assert violations == []


# ── verify_frontend_generated_routes ─────────────────────────


class TestVerifyFrontendGeneratedRoutes:
    def test_clean_generated_routes_passes(self, tmp_path: Path) -> None:
        dest: Path = tmp_path / "features"
        dest.mkdir()
        (tmp_path / "app.routes.generated.ts").write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const generatedRoutes: Routes = [
              { path: 'landing', loadChildren: () => import('./features/landing/landing.routes').then(m => m.LANDING_ROUTES) },
              { path: 'register', loadChildren: () => import('./features/register/register.routes').then(m => m.REGISTER_ROUTES) },
            ];
        """))
        violations: list[str] = vtb.verify_frontend_generated_routes(
            dest, {"landing", "register"},
        )
        assert violations == []

    def test_detects_non_included_feature_in_generated_routes(
        self, tmp_path: Path,
    ) -> None:
        dest: Path = tmp_path / "features"
        dest.mkdir()
        (tmp_path / "app.routes.generated.ts").write_text(textwrap.dedent("""\
            import { Routes } from '@angular/router';
            export const generatedRoutes: Routes = [
              { path: 'analytics', loadChildren: () => import('./features/analytics/analytics.routes').then(m => m.ANALYTICS_ROUTES) },
            ];
        """))
        violations: list[str] = vtb.verify_frontend_generated_routes(dest, {"landing"})
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_no_generated_file_returns_empty(self, tmp_path: Path) -> None:
        dest: Path = tmp_path / "features"
        dest.mkdir()
        violations: list[str] = vtb.verify_frontend_generated_routes(dest, {"landing"})
        assert violations == []
