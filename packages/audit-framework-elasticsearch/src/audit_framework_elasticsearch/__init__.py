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

import importlib.metadata as _md

try:
    __version__ = _md.version("audit-framework-elasticsearch")
except _md.PackageNotFoundError:  # running from source without an install
    __version__ = "0.0.0+unknown"

__all__ = [
    "ElasticsearchSink",
    "ElasticsearchSinkError",
    "HttpResult",
    "httpx_transport",
    "register",
    "__version__",
]
