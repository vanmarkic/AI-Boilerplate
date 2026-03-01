# AI Tooling Setup

This project uses multiple AI coding tools with shared conventions. This document covers setup, configuration, and best practices for each tool.

## Tool Roles

| Tool | Role | Model | Transport |
|------|------|-------|-----------|
| **Claude Code** | Orchestration, planning, multi-file features, reviews | Claude (cloud) | CLI |
| **Continue.dev** | Inline edits, autocomplete, single-file agent tasks | GLM-4.7-Flash (RunPod) | VSCode extension |
| **Aider** | Focused TDD sessions, file-scoped implementation | GLM-4.7-Flash (RunPod) | CLI |

## Task Orchestrator (MCP)

All three tools share persistent task state via [Task Orchestrator](https://github.com/jpicklyk/task-orchestrator), an MCP server that tracks work items, dependencies, and context notes across sessions.

**Why:** Local models (8-32K context) waste tokens rebuilding "where was I?" each session. Task Orchestrator provides a compact briefing via `get_context()` so the model spends tokens on code, not orientation.

### How It Works

```
Session 1: Plan
  → create_work_tree("Feature X", children=[task1, task2, task3])
  → Each task gets a requirements note (400-700 tokens, pseudocode)

Session 2: Implement task 1
  → get_context()              # instant briefing
  → get_next_item()            # "work on task 1"
  → [agent writes code]
  → advance_item(trigger="submit")

Session 3: Implement task 2
  → get_context()              # knows task 1 is done
  → get_next_item()            # "work on task 2"
```

### Setup

Task Orchestrator runs as a Docker container with a named volume for persistence:

```bash
docker pull ghcr.io/jpicklyk/task-orchestrator:latest
```

**Claude Code** — configured via `.mcp.json` in project root (auto-detected).

**Continue.dev** — configured in `~/.continue/config.yaml`:
```yaml
mcpServers:
  - name: Task Orchestrator
    command: docker
    args: [run, --rm, -i, -v, mcp-task-data-ai-boilerplate:/app/data, "ghcr.io/jpicklyk/task-orchestrator:latest"]
```

**Aider** — does not support MCP. Use the CLI bridge or manage tasks manually with a PLAN.md file.

### Workflow: queue → work → review → done

Task Orchestrator enforces a lifecycle with optional phase gates:
- **queue**: task defined, requirements note attached
- **work**: agent claimed the task, implementation in progress
- **review**: code written, awaiting verification
- **done**: tests pass, task complete

Phase gates can require specific notes (e.g., "done-criteria") before a task advances. Configure in `.taskorchestrator/config.yaml`.

### Data Isolation

Each project uses its own Docker volume. The volume name `mcp-task-data-ai-boilerplate` is specific to this project. For other projects, use a different volume name.

## Continue.dev Configuration

Config file: `~/.continue/config.yaml` (global) + `.continue/config.json` (project-level, legacy)

### Models

The primary model is GLM-4.7-Flash running on RunPod (RTX 4090). Use `openai` provider (not `ollama`) for reliable tool-call JSON via the `/v1/chat/completions` endpoint:

```yaml
- name: GLM-4.7-Flash (RunPod)
  provider: openai
  model: glm-4.7-flash
  apiBase: https://<runpod-proxy>/v1
  apiKey: ollama
  contextLength: 32768
  requestOptions:
    timeout: 120000
```

### Agent Mode Caveats

- **Tool call reliability**: Small models (3B active params) may produce malformed tool-call JSON. If the agent outputs raw XML like `<function=run_terminal_command>`, it failed to produce a proper tool call. Re-prompt or switch to Chat mode.
- **Context pressure**: Agent mode adds tool definitions to the system prompt, consuming ~2-4K tokens. With 8K context, this leaves little room for code. Set `contextLength: 32768` if the model supports it.
- **Shell commands**: By default, all shell commands require manual approval ("Potentially dangerous command"). Set individual tool policies to "Automatic" via the tools icon in the input toolbar.

### MCP Servers

Continue supports MCP servers (STDIO and SSE). Configured in `~/.continue/config.yaml` under `mcpServers`. Tool policies (Automatic/Ask/Excluded) are managed via the UI tools panel.

### Model Alternatives (24GB VRAM)

| Model | Active Params | VRAM (Q4_K_M) | Agentic Quality |
|-------|--------------|----------------|-----------------|
| **GLM-4.7-Flash** | 3B MoE | ~19 GB | **Best tool-call reliability** (current) |
| Qwen3 Coder 30B | 3B MoE | ~18 GB | Good code, weaker tool calls |
| Qwen3 14B | 14B dense | ~10.5 GB | Best under 20GB, native tool support |

## Aider Configuration

Config file: `.aider-glm.conf.yml` (default) or `.aider-codestral.conf.yml`

```bash
# Run with config (default uses GLM-4.7-Flash)
aider --config .aider-glm.conf.yml [files...]

# Makefile shortcuts (uses AIDER_CONF variable)
make aider-tdd        # TDD session
make aider-plan       # Write implementation plan
make aider-execute    # Execute plan
make aider-debug      # Systematic debugging

# Override model per-session
make aider-tdd AIDER_CONF=.aider-codestral.conf.yml
```

### Multi-Session Pattern for Aider

Aider has no built-in task persistence. Use a PLAN.md file as read-only context:

```bash
# Pass plan as context each session
aider --config .aider-glm.conf.yml --read PLAN.md features/my_feature/*.py
```

Update PLAN.md manually between sessions to track progress.

## Scaffold Script

`make new-feature name=<name> tier=<N>` generates backend + frontend files.

The script is macOS-compatible (no GNU-only bash features). It generates:
- Backend: model, schema, repository, service, router, test, manifest.yaml, __init__.py
- Frontend: types, service, component, routes, spec

## Best Practices for Local Models

1. **Keep tasks small** — one file, one function, one test at a time
2. **Use Chat mode for code generation** — Agent mode is flaky with small models
3. **Reserve Agent mode for capable models** — GLM-4.7-Flash or cloud models
4. **Provide explicit context** — use `@file` and `@codebase` in Continue, `--read` in Aider
5. **Don't fight tool-call failures** — if the model outputs raw XML, re-prompt or switch modes
6. **Use Task Orchestrator for multi-session work** — compact context handoff vs rebuilding 5000+ tokens
7. **Use OpenAI-compatible endpoint** — `provider: openai` with `/v1` base URL gives better tool-call JSON than native Ollama API
