from fastapi import HTTPException, status

from features.user.user_model import User
from features.user.user_repository import UserRepository
from features.user.user_schema import CreateUserRequest, UserResponse


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(self, request: CreateUserRequest) -> UserResponse:
        existing = await self.repository.get_by_email(request.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )
        user = User(email=request.email, name=request.name)
        created = await self.repository.create(user)
        return UserResponse.model_validate(created)

    async def get_user(self, user_id: int) -> UserResponse:
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return UserResponse.model_validate(user)
