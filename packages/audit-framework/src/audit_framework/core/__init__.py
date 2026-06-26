"""Zero-dependency core of the audit & notification framework.

Re-exports the public surface so callers can ``from audit_framework.core import
Pipeline, AuditEvent, ...`` without reaching into submodules. Concrete adapters
live in separate plugin packages and are wired in via :class:`PluginRegistry`.
"""

from audit_framework.core.decorators import (
    auditable,
    current_actor,
    reset_actor_context,
    set_actor_context,
    set_pipeline_provider,
)
from audit_framework.core.dispatcher import Dispatcher
from audit_framework.core.models import (
    AuditEvent,
    AuditPolicy,
    BroadcastCondition,
    BroadcastPolicy,
    BroadcastTarget,
    EscalationConfig,
    Notification,
    NotificationDirective,
    PipelineContext,
    ThrottleConfig,
)
from audit_framework.core.pipeline import AuditMiddleware, NextCallable, Pipeline
from audit_framework.core.plugin_registry import PluginError, PluginRegistry
from audit_framework.core.policy_engine import (
    AuditPolicyEngine,
    BroadcastPolicyEngine,
    PolicyMatcher,
)

__all__ = [
    # models
    "AuditEvent",
    "AuditPolicy",
    "BroadcastPolicy",
    "BroadcastTarget",
    "BroadcastCondition",
    "ThrottleConfig",
    "EscalationConfig",
    "Notification",
    "NotificationDirective",
    "PipelineContext",
    # pipeline
    "Pipeline",
    "AuditMiddleware",
    "NextCallable",
    # engines / dispatch
    "PolicyMatcher",
    "AuditPolicyEngine",
    "BroadcastPolicyEngine",
    "Dispatcher",
    # registry
    "PluginRegistry",
    "PluginError",
    # decorator API
    "auditable",
    "set_pipeline_provider",
    "set_actor_context",
    "reset_actor_context",
    "current_actor",
]
