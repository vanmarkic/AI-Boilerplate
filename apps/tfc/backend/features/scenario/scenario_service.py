from typing import Union

from pydantic import BaseModel

from core.exceptions import BadRequestError, NotFoundError
from features.scenario.scenario_content import (
    DecisionTemplateDef,
    ScenarioContent,
    ScenarioEventDef,
    ScenarioIssueDef,
)
from features.scenario.scenario_model import Scenario
from features.scenario.scenario_repository import ScenarioRepository
from features.scenario.scenario_schema import (
    CreateScenarioRequest,
    ScenarioResponse,
    UpdateScenarioRequest,
)

ContentEntity = Union[ScenarioEventDef, ScenarioIssueDef, DecisionTemplateDef]

# Maps collection name to the ScenarioContent field name
_COLLECTION_FIELDS: dict[str, str] = {
    "events": "events",
    "issues": "issues",
    "decision_templates": "decision_templates",
}


class ScenarioService:
    def __init__(self, repository: ScenarioRepository) -> None:
        self.repository = repository

    async def create_scenario(
        self,
        request: CreateScenarioRequest,
    ) -> ScenarioResponse:
        scenario = Scenario(
            title=request.title,
            description=request.description,
            domain_id=request.domain_id,
            content=request.content.model_dump(),
            version=request.version,
        )
        created = await self.repository.create(scenario)
        return ScenarioResponse.model_validate(created)

    async def get_scenario(self, scenario_id: int) -> ScenarioResponse:
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise NotFoundError("Scenario not found")
        return ScenarioResponse.model_validate(scenario)

    async def list_scenarios(
        self,
        domain_id: int | None = None,
    ) -> list[ScenarioResponse]:
        if domain_id is not None:
            scenarios = await self.repository.list_by_domain(domain_id)
        else:
            scenarios = await self.repository.list()
        return [ScenarioResponse.model_validate(s) for s in scenarios]

    async def update_scenario(
        self,
        scenario_id: int,
        request: UpdateScenarioRequest,
    ) -> ScenarioResponse:
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise NotFoundError("Scenario not found")

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(scenario, field, value)

        updated = await self.repository.update(scenario)
        return ScenarioResponse.model_validate(updated)

    async def clone_scenario(self, scenario_id: int) -> ScenarioResponse:
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise NotFoundError("Scenario not found")
        clone = Scenario(
            title=f"{scenario.title} (Copy)",
            description=scenario.description,
            domain_id=scenario.domain_id,
            content=scenario.content,
            version=1,
        )
        created = await self.repository.create(clone)
        return ScenarioResponse.model_validate(created)

    async def delete_scenario(self, scenario_id: int) -> None:
        deleted = await self.repository.delete(scenario_id)
        if not deleted:
            raise NotFoundError("Scenario not found")

    # ------------------------------------------------------------------
    # Content entity CRUD helpers
    # ------------------------------------------------------------------

    async def _load_scenario_and_content(
        self,
        scenario_id: int,
    ) -> tuple[Scenario, ScenarioContent]:
        """Load scenario from DB and parse its content JSON."""
        scenario = await self.repository.get_by_id(scenario_id)
        if not scenario:
            raise NotFoundError("Scenario not found")
        raw = scenario.content or {}
        content = ScenarioContent.model_validate(raw)
        return scenario, content

    async def _save_content(
        self,
        scenario: Scenario,
        content: ScenarioContent,
    ) -> ScenarioResponse:
        """Validate integrity, persist content, and return response."""
        self.validate_content_integrity(content)
        scenario.content = content.model_dump()
        updated = await self.repository.update(scenario)
        return ScenarioResponse.model_validate(updated)

    async def add_content_entity(
        self,
        scenario_id: int,
        collection: str,
        entity: ContentEntity,
    ) -> ScenarioResponse:
        """Add an entity to a content collection (events/issues/decisions)."""
        field = _COLLECTION_FIELDS.get(collection)
        if not field:
            raise BadRequestError(f"Unknown content collection: {collection}")

        scenario, content = await self._load_scenario_and_content(scenario_id)
        items: list[BaseModel] = getattr(content, field)

        if any(getattr(item, "id") == entity.id for item in items):
            raise BadRequestError(
                f"Entity with id '{entity.id}' already exists in {collection}"
            )

        items.append(entity)
        return await self._save_content(scenario, content)

    async def update_content_entity(
        self,
        scenario_id: int,
        collection: str,
        entity_id: str,
        entity: ContentEntity,
    ) -> ScenarioResponse:
        """Replace an entity in a content collection by its id."""
        field = _COLLECTION_FIELDS.get(collection)
        if not field:
            raise BadRequestError(f"Unknown content collection: {collection}")

        scenario, content = await self._load_scenario_and_content(scenario_id)
        items: list[BaseModel] = getattr(content, field)

        idx = next(
            (i for i, item in enumerate(items) if getattr(item, "id") == entity_id),
            None,
        )
        if idx is None:
            raise NotFoundError(
                f"Entity '{entity_id}' not found in {collection}"
            )

        if entity.id != entity_id:
            raise BadRequestError(
                f"Entity id in body '{entity.id}' does not match "
                f"path parameter '{entity_id}'"
            )

        items[idx] = entity
        return await self._save_content(scenario, content)

    async def delete_content_entity(
        self,
        scenario_id: int,
        collection: str,
        entity_id: str,
    ) -> None:
        """Remove an entity from a content collection by its id."""
        field = _COLLECTION_FIELDS.get(collection)
        if not field:
            raise BadRequestError(f"Unknown content collection: {collection}")

        scenario, content = await self._load_scenario_and_content(scenario_id)
        items: list[BaseModel] = getattr(content, field)

        original_len = len(items)
        filtered = [item for item in items if getattr(item, "id") != entity_id]
        if len(filtered) == original_len:
            raise NotFoundError(
                f"Entity '{entity_id}' not found in {collection}"
            )

        setattr(content, field, filtered)
        self.validate_content_integrity(content)
        scenario.content = content.model_dump()
        await self.repository.update(scenario)

    # ------------------------------------------------------------------
    # Content integrity validation
    # ------------------------------------------------------------------

    @staticmethod
    def validate_content_integrity(content: ScenarioContent) -> None:
        """Check cross-references between content entities.

        Raises BadRequestError if any reference is broken:
        - Event dependencies must reference existing event IDs
        - Event triggered_issues must reference existing issue IDs
        - Decision template issue_id must reference an existing issue ID
        - Decision template target_roles must reference defined role IDs
        """
        event_ids = {e.id for e in content.events}
        issue_ids = {i.id for i in content.issues}
        role_ids = {r.id for r in content.roles}

        errors: list[str] = []

        for event in content.events:
            for dep_id in event.dependencies:
                if dep_id not in event_ids:
                    errors.append(
                        f"Event '{event.id}' dependency '{dep_id}' "
                        f"references unknown event"
                    )
            for issue_ref in event.triggered_issues:
                if issue_ref not in issue_ids:
                    errors.append(
                        f"Event '{event.id}' triggered_issue '{issue_ref}' "
                        f"references unknown issue"
                    )

        for dt in content.decision_templates:
            if dt.issue_id is not None and dt.issue_id not in issue_ids:
                errors.append(
                    f"Decision template '{dt.id}' issue_id '{dt.issue_id}' "
                    f"references unknown issue"
                )
            for rid in dt.target_roles:
                if rid not in role_ids:
                    errors.append(
                        f"Decision template '{dt.id}' target_role '{rid}' "
                        f"references unknown role"
                    )

        if errors:
            raise BadRequestError(
                "Content integrity errors: " + "; ".join(errors)
            )
