from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class RolePermission(Base):
    """Maps a Keycloak realm role to an allowed API route pattern."""

    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(50), index=True)
    route_pattern: Mapped[str] = mapped_column(String(255))
    method: Mapped[str] = mapped_column(String(10))
    frontend_route: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
