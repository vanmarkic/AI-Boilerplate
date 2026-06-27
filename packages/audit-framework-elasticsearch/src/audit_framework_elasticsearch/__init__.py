"""audit-framework-elasticsearch — index audit events into Elasticsearch/OpenSearch.

An HTTP-based :class:`~audit_framework.core.ports.ExternalSink`. One adapter for
both Elasticsearch and OpenSearch (shared REST API), with no hard HTTP
dependency — the transport is injectable.
"""

from audit_framework_elasticsearch.plugin import register
from audit_framework_elasticsearch.sink import (
    ElasticsearchSink,
    ElasticsearchSinkError,
    HttpResult,
    httpx_transport,
)

__version__ = "0.1.0"

__all__ = [
    "ElasticsearchSink",
    "ElasticsearchSinkError",
    "HttpResult",
    "httpx_transport",
    "register",
    "__version__",
]
