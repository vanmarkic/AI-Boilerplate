from datetime import datetime

from sqlalchemy import String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class DomainConfig(Base):
    __tablename__ = "tfc_domain_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    terminology: Mapped[dict] = mapped_column(JSON, nullable=False)
    theme: Mapped[dict] = mapped_column(JSON, nullable=False)
    roles: Mapped[list] = mapped_column(JSON, nullable=False)
    severity_levels: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )
