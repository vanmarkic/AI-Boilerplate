from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5432/boilerplate"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    app_name: str = "AI Boilerplate API"
    app_version: str = "0.1.0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
