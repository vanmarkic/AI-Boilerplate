from datetime import datetime

from pydantic import BaseModel, EmailStr

from core.base_schema import ResponseBase


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str


class UserResponse(ResponseBase):
    id: int
    email: str
    name: str
    created_at: datetime
