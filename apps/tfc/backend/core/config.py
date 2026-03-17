from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5433/tfc"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    app_name: str = "TFC API"
    app_version: str = "0.1.0"
    allowed_origins: str = "http://localhost:4201"
    port: int = 8001

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Ensure the database URL uses the asyncpg driver.

        Railway provides postgresql:// URLs; SQLAlchemy async needs
        postgresql+asyncpg://.
        """
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self


settings = Settings()
