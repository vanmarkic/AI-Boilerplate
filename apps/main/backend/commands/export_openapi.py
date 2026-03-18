"""Export OpenAPI spec to shared/openapi.json."""

import json
import sys
from pathlib import Path

from main import create_app


def main() -> None:
    app = create_app()
    spec = app.openapi()

    # Inject registered SSE channel names as an enum into the spec.
    from core.sse_router import patch_channel_enum

    spec = patch_channel_enum(spec)

    output = Path(__file__).resolve().parent.parent.parent / "shared" / "openapi.json"
    output.write_text(json.dumps(spec, indent=2) + "\n")
    print(f"OpenAPI spec written to {output}", file=sys.stderr)  # noqa: T201 — CLI script


if __name__ == "__main__":
    main()
