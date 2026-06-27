"""Plugin registration for the Elasticsearch/OpenSearch sink.

Registers the same sink class under two provider names so a config can refer to
``elasticsearch`` or ``opensearch`` (the wire API is identical); pass
``name="opensearch"`` when instantiating if you want the emitted ``sink_name``
to match.
"""

from __future__ import annotations

from typing import Any

from audit_framework_elasticsearch.sink import ElasticsearchSink

__all__ = ["register"]


def register(registry: Any) -> None:
    """Register :class:`ElasticsearchSink` as the elasticsearch/opensearch sink."""
    registry.register("external_sink", "elasticsearch", ElasticsearchSink)
    registry.register("external_sink", "opensearch", ElasticsearchSink)
