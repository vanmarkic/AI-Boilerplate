from fastapi import HTTPException, status

from features.domain_config.domain_config_model import DomainConfig
from features.domain_config.domain_config_repository import (
    DomainConfigRepository,
)
from features.domain_config.domain_config_schema import (
    CreateDomainConfigRequest,
    DomainConfigResponse,
    UpdateDomainConfigRequest,
)


class DomainConfigService:
    def __init__(self, repository: DomainConfigRepository) -> None:
        self.repository = repository

    async def create(
        self,
        request: CreateDomainConfigRequest,
    ) -> DomainConfigResponse:
        existing = await self.repository.get_by_slug(request.slug)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Domain config with slug '{request.slug}' already exists",
            )
        entity = DomainConfig(
            slug=request.slug,
            name=request.name,
            description=request.description,
            terminology=request.terminology.model_dump(),
            theme=request.theme.model_dump(),
            roles=[r.model_dump() for r in request.roles],
            severity_levels=[s.model_dump() for s in request.severity_levels],
        )
        created = await self.repository.create(entity)
        return DomainConfigResponse.model_validate(created)

    async def get(self, config_id: int) -> DomainConfigResponse:
        entity = await self.repository.get_by_id(config_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Domain config not found",
            )
        return DomainConfigResponse.model_validate(entity)

    async def get_by_slug(self, slug: str) -> DomainConfigResponse:
        entity = await self.repository.get_by_slug(slug)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Domain config '{slug}' not found",
            )
        return DomainConfigResponse.model_validate(entity)

    async def list_all(self) -> list[DomainConfigResponse]:
        entities = await self.repository.list()
        return [DomainConfigResponse.model_validate(e) for e in entities]

    async def update(
        self,
        config_id: int,
        request: UpdateDomainConfigRequest,
    ) -> DomainConfigResponse:
        entity = await self.repository.get_by_id(config_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Domain config not found",
            )
        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field in ("terminology", "theme"):
                setattr(entity, field, value)
            elif field == "roles":
                entity.roles = value
            elif field == "severity_levels":
                entity.severity_levels = value
            else:
                setattr(entity, field, value)
        updated = await self.repository.update(entity)
        return DomainConfigResponse.model_validate(updated)

    async def delete(self, config_id: int) -> None:
        deleted = await self.repository.delete(config_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Domain config not found",
            )
