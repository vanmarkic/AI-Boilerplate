"""Framework-free domain errors.

Nothing here knows about HTTP, FastAPI or any vendor.  ``core/exceptions.py``
owns the translation to status codes; that is the only place it happens.

``IntegrationError`` and its subclasses are the vendor-neutral failure
taxonomy every outbound adapter must map onto.  They live in the domain
because ports are phrased in terms of them, and ports may only import domain.
"""


class DomainError(Exception):
    """Base class for every error the core can raise."""


class InvalidIndicatorError(DomainError):
    """An observable value is malformed for its declared type."""


class UnknownEntityError(DomainError):
    """A referenced entity does not exist in our own state."""


class PolicyViolationError(DomainError):
    """A business rule forbids the requested operation."""


class ConflictingStateError(DomainError):
    """The requested state transition is not legal from the current state."""


class IntegrationError(DomainError):
    """An outbound dependency failed.

    Carries the logical system name (``"threat_intel"``, ``"case_management"``,
    ...) rather than the vendor name, so the core never learns who is behind
    the port.
    """

    def __init__(self, system: str, detail: str) -> None:
        self.system = system
        self.detail = detail
        super().__init__(f"{system}: {detail}")


class IntegrationAuthError(IntegrationError):
    """Credentials were rejected (401/403)."""


class IntegrationRejectedError(IntegrationError):
    """The dependency rejected our request (4xx we caused)."""


class IntegrationUnavailableError(IntegrationError):
    """The dependency is unreachable, timing out, or failing (5xx/transport)."""


class IntegrationProtocolError(IntegrationError):
    """The dependency answered in a shape we cannot parse."""
