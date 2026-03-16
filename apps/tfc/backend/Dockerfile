FROM ghcr.io/astral-sh/uv:0.8 AS uv

FROM python:3.12-slim

WORKDIR /app

COPY --from=uv /uv /uvx /bin/

COPY apps/tfc/backend/pyproject.toml ./
COPY apps/tfc/backend/core/ ./core/
COPY apps/tfc/backend/main.py ./
COPY apps/tfc/backend/alembic.ini ./
COPY apps/tfc/backend/alembic/ ./alembic/
COPY apps/tfc/backend/features/ ./features/

RUN uv pip install --system --no-cache -e .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
