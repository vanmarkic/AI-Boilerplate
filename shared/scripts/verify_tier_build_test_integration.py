"""Integration tests: full pipeline with a fake tier-2 feature.

Simulates adding a tier-2 feature and verifying a tier-1 build catches it.
Uses tmp_path to create isolated fake feature directories.
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


# ── Integration: full pipeline with fake tier-2 feature ──────


class TestIntegrationFakeTier2:
    """Simulates adding a tier-2 feature and verifying a tier-1 build catches it."""

    @pytest.fixture()
    def fake_repo(self, tmp_path: Path) -> dict[str, Path]:
        # Backend features
        be_all: Path = tmp_path / "all_backend"
        _make_feature(be_all, "health", tier=1)
        _make_feature(be_all, "user", tier=1)
        _make_feature(be_all, "analytics", tier=2)

        # Filtered backend (tier-1 only)
        be_dest: Path = tmp_path / "filtered_backend"
        _make_feature(be_dest, "health", tier=1)
        _make_feature(be_dest, "user", tier=1)

        # Frontend features
        fe_all: Path = tmp_path / "all_frontend"
        _make_feature(fe_all, "landing", tier=1)
        _make_feature(fe_all, "register", tier=1)
        _make_feature(fe_all, "analytics-dash", tier=2)

        # Filtered frontend (tier-1 only)
        fe_dest: Path = tmp_path / "filtered_frontend"
        _make_feature(fe_dest, "landing", tier=1)
        _make_feature(fe_dest, "register", tier=1)

        # Clean main.py
        main_py: Path = tmp_path / "main.py"
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.user.user_router import router as user_router
        """))

        # Clean app.routes.ts
        routes_ts: Path = tmp_path / "app.routes.ts"
        routes_ts.write_text(textwrap.dedent("""\
            export const routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes') },
              { path: 'register', loadChildren: () => import('./features/register/register.routes') },
            ];
        """))

        # Empty core/shared dirs
        core: Path = tmp_path / "core"
        core.mkdir()
        (core / "config.py").write_text("DB = 'sqlite://'\n")
        shared: Path = tmp_path / "shared"
        shared.mkdir()
        (shared / "util.ts").write_text("export const VERSION = '0.1';\n")

        return {
            "be_dest": be_dest, "fe_dest": fe_dest,
            "be_all": be_all, "fe_all": fe_all,
            "main_py": main_py, "routes_ts": routes_ts,
            "core": core, "shared": shared,
        }

    def test_clean_tier1_build_passes_all_checks(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """A properly filtered tier-1 build with clean entrypoints passes."""
        be: Path = fake_repo["be_dest"]
        fe: Path = fake_repo["fe_dest"]

        all_be: dict[str, int] = vtb._feature_names(fake_repo["be_all"])
        all_fe: dict[str, int] = vtb._feature_names(fake_repo["fe_all"])

        excluded_be: set[str] = vtb._excluded_names(all_be, 1)
        excluded_fe: set[str] = vtb._excluded_names(all_fe, 1)
        included_be: set[str] = vtb._included_names(all_be, 1)
        included_fe: set[str] = vtb._included_names(all_fe, 1)

        assert excluded_be == {"analytics"}
        assert excluded_fe == {"analytics-dash"}

        # All 10 checks should pass
        assert vtb.verify_included_tiers(be, 1, "backend") == []
        assert vtb.verify_filtered_output(be, excluded_be, "backend") == []
        assert vtb.verify_backend_entrypoint(fake_repo["main_py"], excluded_be) == []
        assert vtb.verify_core_no_feature_imports(
            fake_repo["core"], fake_repo["shared"], excluded_be,
        ) == []
        assert vtb.verify_backend_generated_init(be, included_be) == []

        assert vtb.verify_included_tiers(fe, 1, "frontend") == []
        assert vtb.verify_filtered_output(fe, excluded_fe, "frontend") == []
        assert vtb.verify_frontend_routes(fake_repo["routes_ts"], excluded_fe) == []
        assert vtb.verify_core_no_feature_imports(
            fake_repo["core"], fake_repo["shared"], excluded_fe,
        ) == []
        assert vtb.verify_frontend_generated_routes(fe, included_fe) == []

    def test_tier2_dir_leaked_into_build_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If filter-features.py fails and a tier-2 dir leaks through."""
        be: Path = fake_repo["be_dest"]
        _make_feature(be, "analytics", tier=2)
        violations: list[str] = vtb.verify_included_tiers(be, 1, "backend")
        assert len(violations) == 1
        assert "analytics" in violations[0]

    def test_main_py_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If someone adds `from features.analytics...` to main.py."""
        main_py: Path = fake_repo["main_py"]
        main_py.write_text(textwrap.dedent("""\
            from features.health.health_router import router as health_router
            from features.analytics.analytics_router import router as analytics_router
        """))
        violations: list[str] = vtb.verify_backend_entrypoint(main_py, {"analytics"})
        assert len(violations) == 1

    def test_routes_ts_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If someone adds a tier-2 route to app.routes.ts."""
        routes_ts: Path = fake_repo["routes_ts"]
        routes_ts.write_text(textwrap.dedent("""\
            export const routes = [
              { path: '', loadChildren: () => import('./features/landing/landing.routes') },
              { path: 'analytics-dash', loadChildren: () => import('./features/analytics-dash/analytics-dash.routes') },
            ];
        """))
        violations: list[str] = vtb.verify_frontend_routes(routes_ts, {"analytics-dash"})
        assert len(violations) == 1

    def test_core_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If backend/core/ imports a tier-2 feature module."""
        core: Path = fake_repo["core"]
        (core / "deps.py").write_text(
            "from features.analytics.service import AnalyticsService\n",
        )
        violations: list[str] = vtb.verify_core_no_feature_imports(
            core, fake_repo["shared"], {"analytics"},
        )
        assert len(violations) == 1

    def test_shared_importing_excluded_feature_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If frontend/shared/ imports a tier-2 feature path."""
        shared: Path = fake_repo["shared"]
        (shared / "helper.ts").write_text(
            "import { X } from '../../features/analytics-dash/service';\n",
        )
        violations: list[str] = vtb.verify_core_no_feature_imports(
            fake_repo["core"], shared, {"analytics-dash"},
        )
        assert len(violations) == 1

    def test_filtered_output_referencing_excluded_name_is_caught(
        self, fake_repo: dict[str, Path],
    ) -> None:
        """If a tier-1 file in the filtered output references an excluded feature."""
        health: Path = fake_repo["be_dest"] / "health"
        (health / "health_service.py").write_text(
            "# TODO: integrate analytics for health metrics\n",
        )
        violations: list[str] = vtb.verify_filtered_output(
            fake_repo["be_dest"], {"analytics"}, "backend",
        )
        assert len(violations) == 1
