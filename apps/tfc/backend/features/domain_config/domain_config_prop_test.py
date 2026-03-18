"""Property tests for DomainConfig — schema invariants and CRUD contracts.

Tests that for ALL valid domain config payloads:
1. Create → Get roundtrip preserves all fields
2. Slug uniqueness is always enforced
3. Update is partial — unset fields are preserved
4. Delete is idempotent (second delete returns 404)
5. Terminology keys are always present in response
6. List always contains every created config
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from hypothesis import HealthCheck, assume, given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Strategies — generate arbitrary but valid domain config payloads
# ---------------------------------------------------------------------------
TERMINOLOGY_KEYS = [
    "event",
    "issue",
    "player",
    "gameMaster",
    "exercise",
    "scenario",
    "decision",
]

DENSITY_VALUES = ["compact", "comfortable", "spacious"]


def _terminology() -> st.SearchStrategy[dict[str, str]]:
    return st.fixed_dictionaries(
        {
            k: st.text(
                min_size=1,
                max_size=30,
                alphabet=st.characters(
                    whitelist_categories=("L", "N", "Z"),
                ),
            )
            for k in TERMINOLOGY_KEYS
        }
    )


def _hex_color() -> st.SearchStrategy[str]:
    return st.from_regex(r"#[0-9a-f]{6}", fullmatch=True)


def _theme() -> st.SearchStrategy[dict]:
    return st.fixed_dictionaries(
        {
            "colorPrimary": _hex_color(),
            "colorSecondary": _hex_color(),
            "colorBackground": _hex_color(),
            "colorForeground": _hex_color(),
            "fontFamily": st.just("system-ui, sans-serif"),
            "fontFamilyMono": st.just("ui-monospace, monospace"),
            "density": st.sampled_from(DENSITY_VALUES),
        }
    )


def _role() -> st.SearchStrategy[dict]:
    return st.fixed_dictionaries(
        {
            "id": st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnop-"),
            "label": st.text(min_size=1, max_size=30),
            "description": st.text(max_size=60),
        }
    )


def _severity_level(order: int) -> st.SearchStrategy[dict]:
    return st.fixed_dictionaries(
        {
            "id": st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnop"),
            "label": st.text(min_size=1, max_size=30),
            "color": _hex_color(),
            "order": st.just(order),
        }
    )


def _severity_levels() -> st.SearchStrategy[list[dict]]:
    return st.integers(min_value=1, max_value=5).flatmap(
        lambda n: st.tuples(*[_severity_level(i + 1) for i in range(n)]).map(list)
    )


def _slug() -> st.SearchStrategy[str]:
    return st.from_regex(r"[a-z][a-z0-9\-]{1,20}", fullmatch=True)


@st.composite
def domain_config_payloads(draw: st.DrawFn) -> dict:
    return {
        "slug": draw(_slug()),
        "name": draw(st.text(min_size=1, max_size=50)),
        "description": draw(st.text(max_size=100)),
        "terminology": draw(_terminology()),
        "theme": draw(_theme()),
        "roles": draw(st.lists(_role(), min_size=1, max_size=4, unique_by=lambda r: r["id"])),
        "severity_levels": draw(_severity_levels()),
    }


# ---------------------------------------------------------------------------
# Property tests — async, each gets a fresh database via conftest
# ---------------------------------------------------------------------------


class TestCreateGetRoundtrip:
    """Creating then fetching a domain config preserves all fields."""

    @given(payload=domain_config_payloads())
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_roundtrip(self, payload: dict, client: AsyncClient) -> None:
        create_resp = await client.post("/api/domain-configs", json=payload)
        if create_resp.status_code == 409:
            return  # slug collision with a prior example in same DB
        assert create_resp.status_code == 201
        created = create_resp.json()

        get_resp = await client.get(f"/api/domain-configs/{created['id']}")
        assert get_resp.status_code == 200
        fetched = get_resp.json()

        assert fetched["slug"] == payload["slug"]
        assert fetched["name"] == payload["name"]
        assert fetched["terminology"] == payload["terminology"]
        assert fetched["theme"] == payload["theme"]
        assert fetched["roles"] == payload["roles"]
        assert fetched["severity_levels"] == payload["severity_levels"]


class TestSlugUniqueness:
    """Two configs with the same slug cannot coexist."""

    @given(payload=domain_config_payloads())
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_duplicate_slug_rejected(
        self,
        payload: dict,
        client: AsyncClient,
    ) -> None:
        first = await client.post("/api/domain-configs", json=payload)
        if first.status_code != 201:
            return
        second = await client.post("/api/domain-configs", json=payload)
        assert second.status_code == 409


class TestPartialUpdate:
    """Updating a subset of fields preserves the rest."""

    @given(
        payload=domain_config_payloads(),
        new_name=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=40, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_partial_update_preserves_other_fields(
        self,
        payload: dict,
        new_name: str,
        client: AsyncClient,
    ) -> None:
        create_resp = await client.post("/api/domain-configs", json=payload)
        if create_resp.status_code != 201:
            return
        config_id = create_resp.json()["id"]

        update_resp = await client.put(
            f"/api/domain-configs/{config_id}",
            json={"name": new_name},
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()

        assert updated["name"] == new_name
        assert updated["slug"] == payload["slug"]
        assert updated["terminology"] == payload["terminology"]
        assert updated["theme"] == payload["theme"]
        assert updated["roles"] == payload["roles"]


class TestDeleteIdempotent:
    """Deleting a config then trying again returns 404."""

    @given(payload=domain_config_payloads())
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_delete_then_404(
        self,
        payload: dict,
        client: AsyncClient,
    ) -> None:
        create_resp = await client.post("/api/domain-configs", json=payload)
        if create_resp.status_code != 201:
            return
        config_id = create_resp.json()["id"]

        first_del = await client.delete(f"/api/domain-configs/{config_id}")
        assert first_del.status_code == 204

        second_del = await client.delete(f"/api/domain-configs/{config_id}")
        assert second_del.status_code == 404

        get_resp = await client.get(f"/api/domain-configs/{config_id}")
        assert get_resp.status_code == 404


class TestTerminologyKeysAlwaysPresent:
    """Every response terminology dict contains all 7 required keys."""

    @given(payload=domain_config_payloads())
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_all_keys_present(
        self,
        payload: dict,
        client: AsyncClient,
    ) -> None:
        create_resp = await client.post("/api/domain-configs", json=payload)
        if create_resp.status_code != 201:
            return
        terminology = create_resp.json()["terminology"]
        for key in TERMINOLOGY_KEYS:
            assert key in terminology, f"Missing key: {key}"
            assert isinstance(terminology[key], str)
            assert len(terminology[key]) > 0


class TestListContainsAllCreated:
    """List endpoint returns every config that was created."""

    @given(
        slugs=st.lists(
            _slug(),
            min_size=1,
            max_size=5,
            unique=True,
        ),
    )
    @settings(max_examples=20, suppress_health_check=[HealthCheck.function_scoped_fixture])
    @pytest.mark.asyncio
    async def test_list_completeness(
        self,
        slugs: list[str],
        client: AsyncClient,
    ) -> None:
        created_slugs: list[str] = []
        for slug in slugs:
            base_payload = {
                "slug": slug,
                "name": f"Domain {slug}",
                "description": "",
                "terminology": {k: k.title() for k in TERMINOLOGY_KEYS},
                "theme": {
                    "colorPrimary": "#000000",
                    "colorSecondary": "#111111",
                    "colorBackground": "#ffffff",
                    "colorForeground": "#1e293b",
                    "fontFamily": "system-ui, sans-serif",
                    "fontFamilyMono": "ui-monospace, monospace",
                    "density": "comfortable",
                },
                "roles": [{"id": "r1", "label": "Role", "description": ""}],
                "severity_levels": [
                    {"id": "s1", "label": "Sev", "color": "#000000", "order": 1},
                ],
            }
            resp = await client.post("/api/domain-configs", json=base_payload)
            if resp.status_code == 201:
                created_slugs.append(slug)

        assume(len(created_slugs) > 0)

        list_resp = await client.get("/api/domain-configs")
        assert list_resp.status_code == 200
        listed_slugs = {d["slug"] for d in list_resp.json()}
        for slug in created_slugs:
            assert slug in listed_slugs
