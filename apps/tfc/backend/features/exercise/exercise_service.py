from core.exceptions import BadRequestError, NotFoundError
from features.exercise.exercise_model import Exercise
from features.exercise.exercise_repository import ExerciseRepository
from features.exercise.exercise_schema import (
    VALID_GAME_MODES,
    CreateExerciseRequest,
    ExerciseResponse,
    UpdateExerciseRequest,
)

VALID_PHASES = {"setup", "running", "paused", "completed"}

# Allowed phase transitions: current -> set of valid next phases
PHASE_TRANSITIONS: dict[str, set[str]] = {
    "setup": {"running"},
    "running": {"paused", "completed"},
    "paused": {"running", "completed"},
    "completed": set(),
}


class ExerciseService:
    def __init__(self, repository: ExerciseRepository) -> None:
        self.repository = repository

    async def create_exercise(
        self, request: CreateExerciseRequest,
    ) -> ExerciseResponse:
        if request.phase not in VALID_PHASES:
            raise BadRequestError(f"Invalid phase: {request.phase}")
        if request.game_mode not in VALID_GAME_MODES:
            raise BadRequestError(f"Invalid game_mode: {request.game_mode}")
        exercise = Exercise(
            title=request.title,
            description=request.description,
            phase=request.phase,
            scenario_id=request.scenario_id,
            domain_id=request.domain_id,
            time_factor=request.time_factor,
            game_mode=request.game_mode,
        )
        created = await self.repository.create(exercise)
        return ExerciseResponse.model_validate(created)

    async def get_exercise(self, exercise_id: int) -> ExerciseResponse:
        exercise = await self.repository.get_by_id(exercise_id)
        if not exercise:
            raise NotFoundError("Exercise not found")
        return ExerciseResponse.model_validate(exercise)

    async def get_exercise_by_code(
        self, session_code: str,
    ) -> ExerciseResponse:
        exercise = await self.repository.get_by_session_code(session_code)
        if not exercise:
            raise NotFoundError("Exercise not found for session code")
        return ExerciseResponse.model_validate(exercise)

    async def list_exercises(
        self, phase: str | None = None,
    ) -> list[ExerciseResponse]:
        if phase:
            exercises = await self.repository.list_by_phase(phase)
        else:
            exercises = await self.repository.list()
        return [ExerciseResponse.model_validate(e) for e in exercises]

    async def update_exercise(
        self, exercise_id: int, request: UpdateExerciseRequest,
    ) -> ExerciseResponse:
        exercise = await self.repository.get_by_id(exercise_id)
        if not exercise:
            raise NotFoundError("Exercise not found")

        if request.phase is not None:
            self._validate_phase_transition(exercise.phase, request.phase)

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(exercise, field, value)

        updated = await self.repository.update(exercise)
        return ExerciseResponse.model_validate(updated)

    async def delete_exercise(self, exercise_id: int) -> None:
        deleted = await self.repository.delete(exercise_id)
        if not deleted:
            raise NotFoundError("Exercise not found")

    @staticmethod
    def _validate_phase_transition(
        current_phase: str, new_phase: str,
    ) -> None:
        """Validate that the phase transition is allowed."""
        if new_phase not in VALID_PHASES:
            raise BadRequestError(f"Invalid phase: {new_phase}")
        allowed = PHASE_TRANSITIONS.get(current_phase, set())
        if new_phase != current_phase and new_phase not in allowed:
            raise BadRequestError(
                f"Cannot transition from '{current_phase}' "
                f"to '{new_phase}'"
            )
