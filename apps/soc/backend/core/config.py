from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Provider fields select which adapter implements each outbound port.  They
    are the swap points: changing ``threat_intel_provider`` from ``misp`` to
    ``memory`` (or to a future ``opencti``) requires no change to ``domain/``
    or ``application/``.
    """

    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5432/soc"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    app_name: str = "SOC Platform API"
    app_version: str = "0.1.0"

    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "boilerplate"
    keycloak_audience: str = "backend-api"

    # --- port → adapter selection -----------------------------------------
    search_provider: str = "memory"  # memory | opensearch
    threat_intel_provider: str = "memory"  # memory | misp
    case_provider: str = "memory"  # memory | iris
    orchestration_provider: str = "memory"  # memory | shuffle
    repository_provider: str = "memory"  # memory | postgres

    # --- OpenSearch --------------------------------------------------------
    opensearch_url: str = "http://localhost:9200"
    opensearch_username: str = ""
    opensearch_password: str = ""
    opensearch_verify_tls: bool = True
    opensearch_event_index: str = "soc-events"
    opensearch_indicator_index: str = "soc-indicators"

    # --- MISP --------------------------------------------------------------
    misp_url: str = "https://misp.local"
    misp_api_key: str = ""
    misp_verify_tls: bool = True

    # --- DFIR-IRIS ---------------------------------------------------------
    iris_url: str = "https://iris.local"
    iris_api_key: str = ""
    iris_verify_tls: bool = True
    iris_customer_id: int = 1

    # --- Shuffle -----------------------------------------------------------
    shuffle_url: str = "https://shuffle.local"
    shuffle_api_key: str = ""
    shuffle_verify_tls: bool = True

    # --- outbound HTTP behaviour ------------------------------------------
    http_timeout_seconds: float = 10.0
    http_max_retries: int = 3
    http_backoff_base_seconds: float = 0.2

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
