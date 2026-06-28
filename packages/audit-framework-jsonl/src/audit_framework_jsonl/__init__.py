"""audit-framework-jsonl — append-only JSONL file sink for audit-framework.

The reference :class:`~audit_framework.core.ports.ExternalSink` implementation:
copy ``sink.py`` as the template for your own sink (Splunk HEC, Elasticsearch,
syslog, …).
"""

from audit_framework_jsonl.plugin import register
from audit_framework_jsonl.sink import JsonlFileSink

import importlib.metadata as _md

try:
    __version__ = _md.version("audit-framework-jsonl")
except _md.PackageNotFoundError:  # running from source without an install
    __version__ = "0.0.0+unknown"

__all__ = ["JsonlFileSink", "register", "__version__"]
