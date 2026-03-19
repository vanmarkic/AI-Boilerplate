#!/usr/bin/env python3
"""Generate TypeScript interfaces from Python TypedDicts and Pydantic models.

Usage:
    python apps/tfc/codegen/generate-types.py

Reads:
    - apps/tfc/backend/engine/state_changes.py (TypedDicts)
Writes:
    - apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
"""

from __future__ import annotations

import ast
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # apps/tfc/
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend/src/app/core/generated"

HEADER = '''\
// @generated — DO NOT EDIT. Regenerate with: python apps/tfc/codegen/generate-types.py
// Source: {source}
'''

# Python type → TypeScript type mapping
TYPE_MAP: dict[str, str] = {
    "str": "string",
    "int": "number",
    "float": "number",
    "bool": "boolean",
    "None": "null",
}


def py_type_to_ts(annotation: ast.expr) -> str:
    """Convert a Python type annotation AST node to a TypeScript type string."""
    if isinstance(annotation, ast.Constant):
        if annotation.value is None:
            return "null"
        return str(annotation.value)

    if isinstance(annotation, ast.Name):
        name = annotation.id
        if name in TYPE_MAP:
            return TYPE_MAP[name]
        # Reference to another TypedDict — keep the name
        return name

    if isinstance(annotation, ast.Attribute):
        # e.g., typing.Optional — shouldn't appear with __future__ annotations
        return "unknown"

    if isinstance(annotation, ast.Subscript):
        base = annotation.slice
        if isinstance(annotation.value, ast.Name):
            container = annotation.value.id
            if container == "list":
                inner = py_type_to_ts(base)
                return f"{inner}[]"
            if container == "dict":
                if isinstance(base, ast.Tuple) and len(base.elts) == 2:
                    key = py_type_to_ts(base.elts[0])
                    val = py_type_to_ts(base.elts[1])
                    return f"Record<{key}, {val}>"
            if container == "Optional":
                inner = py_type_to_ts(base)
                return f"{inner} | null"
        return "unknown"

    if isinstance(annotation, ast.BinOp) and isinstance(annotation.op, ast.BitOr):
        left = py_type_to_ts(annotation.left)
        right = py_type_to_ts(annotation.right)
        return f"{left} | {right}"

    return "unknown"


def extract_typeddict_literal_type(comment: str | None) -> str | None:
    """Extract a literal type hint from a comment like '# "phase_change"'."""
    if not comment:
        return None
    match = re.search(r'"([^"]+)"', comment)
    return match.group(1) if match else None


def parse_typeddicts(source_path: Path) -> list[dict]:
    """Parse all TypedDict classes from a Python source file."""
    source = source_path.read_text()
    tree = ast.parse(source)
    source_lines = source.splitlines()

    results = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        # Check if it inherits from TypedDict
        is_typeddict = any(
            (isinstance(b, ast.Name) and b.id == "TypedDict")
            for b in node.bases
        )
        if not is_typeddict:
            continue

        fields = []
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                field_name = item.target.id
                ts_type = py_type_to_ts(item.annotation)

                # Check for literal type hint in inline comment
                line = source_lines[item.lineno - 1] if item.lineno <= len(source_lines) else ""
                comment_match = re.search(r"#\s*(.+)$", line)
                comment = comment_match.group(1) if comment_match else None
                literal = extract_typeddict_literal_type(comment)
                if literal and field_name == "type":
                    ts_type = f'"{literal}"'

                fields.append((field_name, ts_type))

        results.append({
            "name": node.name,
            "fields": fields,
            "docstring": ast.get_docstring(node),
        })

    return results


def parse_union_alias(source_path: Path) -> dict[str, list[str]] | None:
    """Parse type alias unions like StateChange = PhaseChange | EventChange | ..."""
    source = source_path.read_text()
    tree = ast.parse(source)

    unions = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and isinstance(node.value, ast.BinOp):
                # Collect all members of a | chain
                members = []
                def collect_bitor(n: ast.expr) -> None:
                    if isinstance(n, ast.BinOp) and isinstance(n.op, ast.BitOr):
                        collect_bitor(n.left)
                        collect_bitor(n.right)
                    elif isinstance(n, ast.Name):
                        members.append(n.id)
                collect_bitor(node.value)
                if members:
                    unions[target.id] = members

    return unions if unions else None


def emit_typescript(typeddicts: list[dict], unions: dict[str, list[str]] | None, source_rel: str) -> str:
    """Emit TypeScript source from parsed TypedDicts."""
    lines = [HEADER.format(source=source_rel)]

    for td in typeddicts:
        if td["docstring"]:
            lines.append(f"/** {td['docstring']} */")
        lines.append(f"export interface {td['name']} {{")
        for field_name, ts_type in td["fields"]:
            lines.append(f"  {field_name}: {ts_type};")
        lines.append("}\n")

    if unions:
        for name, members in unions.items():
            lines.append(f"export type {name} =")
            for i, member in enumerate(members):
                prefix = "  | " if i > 0 else "  "
                suffix = ";" if i == len(members) - 1 else ""
                lines.append(f"{prefix}{member}{suffix}")
            lines.append("")

    return "\n".join(lines)


def main() -> None:
    # Parse state_changes.py
    state_changes_path = BACKEND / "engine" / "state_changes.py"
    if not state_changes_path.exists():
        print(f"Error: {state_changes_path} not found", file=sys.stderr)
        sys.exit(1)

    typeddicts = parse_typeddicts(state_changes_path)
    unions = parse_union_alias(state_changes_path)
    source_rel = "apps/tfc/backend/engine/state_changes.py"

    # Ensure output directory exists
    FRONTEND.mkdir(parents=True, exist_ok=True)

    # Write state-changes.types.ts
    output_path = FRONTEND / "state-changes.types.ts"
    ts_source = emit_typescript(typeddicts, unions, source_rel)
    output_path.write_text(ts_source)
    print(f"Generated {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
