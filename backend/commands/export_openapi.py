"""Export OpenAPI spec to shared/openapi.json."""
import json
import sys
from pathlib import Path

from main import create_app


def main() -> None:
    app = create_app()
    spec = app.openapi()
    output = Path(__file__).resolve().parent.parent.parent / "shared" / "openapi.json"
    output.write_text(json.dumps(spec, indent=2) + "\n")
    print(f"OpenAPI spec written to {output}", file=sys.stderr)


if __name__ == "__main__":
    main()
