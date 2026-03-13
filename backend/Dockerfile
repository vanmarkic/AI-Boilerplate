# Stage 1: Filter features by tier
FROM python:3.12-slim AS feature-filter
ARG TIER=3
RUN pip install pyyaml
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip install /monorepo-tier-filter/
COPY shared/scripts/filter-features.py /filter.py
COPY backend/features/ /all-features/
RUN python /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/

# uv image — override to use an internal registry:
#   docker build --build-arg UV_IMAGE=registry.corp.com/astral/uv:0.8 ...
ARG UV_IMAGE=ghcr.io/astral-sh/uv:0.8
FROM ${UV_IMAGE} AS uv

# Stage 2: Build backend with only filtered features
FROM python:3.12-slim

WORKDIR /app

COPY --from=uv /uv /uvx /bin/

# Copy source first so setuptools can find packages
COPY backend/pyproject.toml backend/uv.lock ./
COPY backend/core/ ./core/
COPY backend/main.py ./
COPY backend/alembic.ini ./
COPY backend/alembic/ ./alembic/
COPY --from=feature-filter /filtered-features/ ./features/

# Reproducible install from lock file (requires uv.lock to be present)
RUN uv sync --frozen --no-dev --no-cache

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
