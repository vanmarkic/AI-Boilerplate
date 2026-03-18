"""Game mode identifiers re-exported for the schema/features layer.

Canonical definitions live in ``engine.game_modes`` (domain kernel).
This module exists so that Pydantic schemas and REST request models
can reference game mode constants without importing directly from
``engine/``, keeping the dependency direction clean:

    features/schemas  →  core/game_mode_constants  →  engine/game_modes
    (outer ring)          (re-export shim)              (domain kernel)
"""
from engine.game_modes import (  # noqa: F401
    GM_CLASSIC,
    GM_SIMPLE_COLLABORATIVE,
    GameModeName,
    VALID_GAME_MODES,
)
