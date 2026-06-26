# audit-framework-jsonl

An append-only **JSON-Lines file sink** for
[`audit-framework`](../audit-framework) — and the **reference implementation**
every other `ExternalSink` (Splunk HEC, Elasticsearch, syslog, …) can be copied
from.

It implements the `ExternalSink` port: one compact JSON object per line,
appended to a file. Writes are serialised and offloaded off the event loop, with
optional rotation by date and/or size.

## Install

```bash
pip install audit-framework-jsonl
```

## Use

```python
from audit_framework_jsonl.sink import JsonlFileSink
from audit_framework.core.middlewares.sink_fanout import SinkFanOutMiddleware

sink = JsonlFileSink("/var/log/audit/audit.jsonl", daily=True, max_bytes=50_000_000)
pipeline.use(SinkFanOutMiddleware([sink]))   # fan events out to this sink
```

Or wire it by configuration through the registry — it advertises itself under
the `audit_framework.plugins` entry point as the `file_jsonl` external sink:

```python
registry.discover_entrypoints()                 # finds file_jsonl
SinkClass = registry.get("external_sink", "file_jsonl")
sink = SinkClass("/var/log/audit/audit.jsonl")
```

Each emitted line is `event.to_dict()` serialised compactly, e.g.:

```json
{"actor_id":"alice","action":"DELETE","resource_type":"contract","resource_id":"c-42",...}
```

### Options

| Param | Effect |
|---|---|
| `name` | The `sink_name` used for per-policy sink filtering (default `"file_jsonl"`). |
| `daily` | Write to a date-stamped file `audit-YYYY-MM-DD.jsonl` (one per UTC day). |
| `max_bytes` | Roll the current file aside (`audit.<timestamp>.jsonl`) before it exceeds this size. Composes with `daily`. |
| `clock` | Injectable time source for rotation stamps (testing). |

## Writing your own sink

`sink.py` is deliberately tiny — copy it and change four things:

1. a stable `sink_name` (matched against `AuditPolicy.sinks`),
2. `async emit(event, context)` — forward `event.to_dict()` to your platform (best-effort; raise on permanent failure so the pipeline records it),
3. `async health_check()` — report reachability,
4. a `register(registry)` that calls `registry.register("external_sink", "<name>", YourSink)` (+ an `audit_framework.plugins` entry point in `pyproject.toml`).

## Development

```bash
pip install -e ".[dev]"
pytest        # 9 stdlib-only tests (tmp files; no infrastructure)
```

## License

MIT
