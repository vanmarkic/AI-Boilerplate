from pydantic import BaseModel


class ResponseBase(BaseModel):
    """Base class for all response schemas.

    Includes from_attributes so domain objects can be validated directly.
    """

    model_config = {"from_attributes": True}
