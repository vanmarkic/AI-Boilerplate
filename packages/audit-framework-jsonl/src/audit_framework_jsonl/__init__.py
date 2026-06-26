"""audit-framework-jsonl — append-only JSONL file sink for audit-framework.

The reference :class:`~audit_framework.core.ports.ExternalSink` implementation:
copy ``sink.py`` as the template for your own sink (Splunk HEC, Elasticsearch,
syslog, …).
"""

from audit_framework_jsonl.plugin import register
from audit_framework_jsonl.sink import JsonlFileSink

__version__ = "0.1.0"

__all__ = ["JsonlFileSink", "register", "__version__"]
