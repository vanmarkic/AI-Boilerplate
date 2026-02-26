from fastapi import APIRouter, Depends, status

from core.dependencies import get_user_service
from features.user.user_schema import CreateUserRequest, UserResponse
from features.user.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user(
    request: CreateUserRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    return await service.create_user(request)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    return await service.get_user(user_id)
