"""Tunable policy knobs, as data.

Every threshold the platform uses lives here and is injected into the pure
policies.  Nothing is hardcoded inside a policy function, so re-tuning the SOC
is a configuration change and every policy test can state its own thresholds.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field

from domain.event_entity import AssetCriticality
from domain.verdict_entity import Severity


@dataclass(frozen=True, slots=True)
class ScoringRules:
    """Additive scoring weights for severity."""

    category_base: Mapping[str, int] = field(default_factory=dict)
    criticality_bonus: Mapping[AssetCriticality, int] = field(default_factory=dict)
    label_bonus: Mapping[str, int] = field(default_factory=dict)
    severity_thresholds: Mapping[Severity, int] = field(default_factory=dict)
    intel_weight: int = 50
    allowlist_penalty: int = 100
    default_category_score: int = 10


@dataclass(frozen=True, slots=True)
class DispositionRules:
    """Severity floors at which each disposition kicks in."""

    escalate_at: Severity = Severity.HIGH
    alert_at: Severity = Severity.MEDIUM
    monitor_at: Severity = Severity.LOW
    crown_jewel_escalates_at: Severity = Severity.MEDIUM


@dataclass(frozen=True, slots=True)
class DecayRules:
    """How indicator confidence ages out."""

    half_life_days: float = 30.0
    floor_confidence: int = 0
    expire_below: int = 10
    grace_days: int = 1


DEFAULT_SCORING_RULES = ScoringRules(
    category_base={
        "malware": 50,
        "intrusion": 45,
        "exfiltration": 55,
        "auth_failure": 20,
        "policy_violation": 15,
        "uncategorized": 10,
    },
    criticality_bonus={
        AssetCriticality.LOW: -5,
        AssetCriticality.STANDARD: 0,
        AssetCriticality.HIGH: 10,
        AssetCriticality.CROWN_JEWEL: 25,
    },
    label_bonus={
        "ransomware": 30,
        "c2": 25,
        "phishing": 15,
        "apt": 25,
    },
    severity_thresholds={
        Severity.INFO: 0,
        Severity.LOW: 20,
        Severity.MEDIUM: 45,
        Severity.HIGH: 70,
        Severity.CRITICAL: 90,
    },
)

DEFAULT_DISPOSITION_RULES = DispositionRules()
DEFAULT_DECAY_RULES = DecayRules()
