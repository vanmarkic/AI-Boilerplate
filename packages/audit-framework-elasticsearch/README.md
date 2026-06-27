# audit-framework-elasticsearch

An **Elasticsearch / OpenSearch** sink for
[`audit-framework`](../audit-framework): indexes each audit event as a document
so you can search, filter, and dashboard your audit log (Kibana / OpenSearch
Dashboards) with no custom UI.

One adapter serves **both** Elasticsearch and OpenSearch — they share the same
document-indexing and cluster-health REST API.

## Install

```bash
pip install audit-framework-elasticsearch          # bring your own transport
pip install audit-framework-elasticsearch[httpx]   # + the convenience httpx transport
```

## Use

```python
from audit_framework_elasticsearch.sink import ElasticsearchSink, httpx_transport
from audit_framework.core.middlewares.sink_fanout import SinkFanOutMiddleware
import httpx

client = httpx.AsyncClient(timeout=10.0)            # pooled, app-lifetime
sink = ElasticsearchSink(
    "https://es.internal:9200",
    index="audit",                                  # → daily index audit-2026.06.26
    api_key="...",                                  # Authorization: ApiKey ...
    transport=httpx_transport(client),
)
pipeline.use(SinkFanOutMiddleware([sink]))
```

OpenSearch is identical — point `base_url` at your cluster and (optionally) pass
`name="opensearch"`. Via the registry, both names resolve to the same class:

```python
registry.discover_entrypoints()
SinkClass = registry.get("external_sink", "opensearch")   # or "elasticsearch"
```

### No hard HTTP dependency

The sink talks to the cluster through an injected async `transport`
`(method, url, json_body, headers) -> HttpResult`, so it's fully unit-testable
without a network and you control the HTTP client / pooling. `httpx_transport()`
is provided for convenience (the `httpx` extra); supply a shared
`httpx.AsyncClient` in production.

### Behaviour

- `emit` → `POST {base}/{index}[-YYYY.MM.DD]/_doc` with `event.to_dict()`; a
  non-2xx response raises `ElasticsearchSinkError` so `SinkFanOutMiddleware`
  records the failure (without aborting other sinks).
- `health_check` → `GET {base}/_cluster/health`, True when reachable and not
  `red`.
- Daily indices (`daily=True`, the default) map cleanly onto ILM/ISM retention
  policies — aligning with per-policy `retention_days`.

## Development

```bash
pip install -e ".[dev]"
pytest        # 13 stdlib-only tests (fake transport; no httpx/network needed)
```

## License

MIT
