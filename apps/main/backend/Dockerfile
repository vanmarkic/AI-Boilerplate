# Stage 1: Filter features by tier
FROM python:3.12-slim AS feature-filter
ARG TIER=3
RUN pip install pyyaml
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip install /monorepo-tier-filter/
COPY shared/scripts/filter-features.py /filter.py
COPY apps/main/backend/features/ /all-features/
RUN python /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/

FROM ghcr.io/astral-sh/uv:0.8 AS uv

# Stage 2: Build backend with only filtered features
FROM python:3.12-slim

WORKDIR /app

COPY --from=uv /uv /uvx /bin/

COPY apps/main/backend/pyproject.toml apps/main/backend/uv.lock ./
COPY apps/main/backend/core/ ./core/
COPY apps/main/backend/main.py ./
COPY apps/main/backend/alembic.ini ./
COPY apps/main/backend/alembic/ ./alembic/
COPY --from=feature-filter /filtered-features/ ./features/

ENV UV_INDEX_URL=https://developers.naval-group.com/nexus/repository/pypi-group/simple/
RUN uv sync --frozen --no-dev --no-cache

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
