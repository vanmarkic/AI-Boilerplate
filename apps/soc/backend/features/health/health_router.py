"""Liveness and adapter-binding reporting."""

from fastapi import APIRouter, status

from core import registry
from features.health.health_schema import AdapterBindingResponse, HealthResponse

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get(
    "", response_model=HealthResponse, status_code=status.HTTP_200_OK, operation_id="getHealth"
)
async def get_health() -> HealthResponse:
    """Report that the service is up."""
    return HealthResponse(status="ok")


@router.get(
    "/adapters",
    response_model=AdapterBindingResponse,
    status_code=status.HTTP_200_OK,
    operation_id="getAdapterBindings",
)
async def get_adapter_bindings() -> AdapterBindingResponse:
    """Report which implementation is bound to each outbound port.

    Lets an operator see at a glance whether the platform is talking to real
    systems or running self-contained.
    """
    return AdapterBindingResponse(providers=dict(registry.bound_providers()))
