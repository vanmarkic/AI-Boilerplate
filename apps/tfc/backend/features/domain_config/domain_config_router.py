from fastapi import APIRouter, Depends, status

from core.dependencies import get_domain_config_service
from features.domain_config.domain_config_schema import (
    CreateDomainConfigRequest,
    DomainConfigResponse,
    UpdateDomainConfigRequest,
)
from features.domain_config.domain_config_service import DomainConfigService

router = APIRouter(prefix="/api/domain-configs", tags=["domain-configs"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=DomainConfigResponse,
    operation_id="createDomainConfig",
)
async def create_domain_config(
    request: CreateDomainConfigRequest,
    service: DomainConfigService = Depends(get_domain_config_service),
) -> DomainConfigResponse:
    return await service.create(request)


@router.get(
    "",
    response_model=list[DomainConfigResponse],
    operation_id="listDomainConfigs",
)
async def list_domain_configs(
    service: DomainConfigService = Depends(get_domain_config_service),
) -> list[DomainConfigResponse]:
    return await service.list_all()


@router.get(
    "/by-slug/{slug}",
    response_model=DomainConfigResponse,
    operation_id="getDomainConfigBySlug",
)
async def get_domain_config_by_slug(
    slug: str,
    service: DomainConfigService = Depends(get_domain_config_service),
) -> DomainConfigResponse:
    return await service.get_by_slug(slug)


@router.get(
    "/{config_id}",
    response_model=DomainConfigResponse,
    operation_id="getDomainConfig",
)
async def get_domain_config(
    config_id: int,
    service: DomainConfigService = Depends(get_domain_config_service),
) -> DomainConfigResponse:
    return await service.get(config_id)


@router.put(
    "/{config_id}",
    response_model=DomainConfigResponse,
    operation_id="updateDomainConfig",
)
async def update_domain_config(
    config_id: int,
    request: UpdateDomainConfigRequest,
    service: DomainConfigService = Depends(get_domain_config_service),
) -> DomainConfigResponse:
    return await service.update(config_id, request)


@router.delete(
    "/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteDomainConfig",
)
async def delete_domain_config(
    config_id: int,
    service: DomainConfigService = Depends(get_domain_config_service),
) -> None:
    await service.delete(config_id)
