"""Validate all seed JSON files against ScenarioContent schema.

Runs at Docker build time (no DB required). Exit code 1 on any failure.
Usage: python validate_seeds.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pydantic import ValidationError

from features.scenario.scenario_content import ScenarioContent

SEEDS_DIR = Path(__file__).parent / "seeds"


def validate_all_seeds() -> list[str]:
    """Return a list of error messages (empty = all valid)."""
    errors: list[str] = []
    seed_files = sorted(SEEDS_DIR.glob("*.json"))
    if not seed_files:
        return errors

    for path in seed_files:
        data = json.loads(path.read_text())
        content = data.get("content")
        if content is None:
            errors.append(f"{path.name}: missing 'content' key")
            continue
        try:
            ScenarioContent.model_validate(content)
        except ValidationError as exc:
            errors.append(f"{path.name}: {exc}")
    return errors


def main() -> None:
    errors = validate_all_seeds()
    if errors:
        print("Seed validation FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    count = len(list(SEEDS_DIR.glob("*.json")))
    print(f"All seed files valid ({count} files).")


if __name__ == "__main__":
    main()
