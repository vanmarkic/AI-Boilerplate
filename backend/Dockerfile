# Stage 1: Filter features by tier
FROM python:3.12-slim AS feature-filter
ARG TIER=3
RUN pip install pyyaml
COPY shared/scripts/filter-features.py /filter.py
COPY backend/features/ /all-features/
RUN python /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/

# Stage 2: Build backend with only filtered features
FROM python:3.12-slim

WORKDIR /app

COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

COPY backend/core/ ./core/
COPY backend/main.py ./
COPY backend/alembic.ini ./
COPY backend/alembic/ ./alembic/
COPY --from=feature-filter /filtered-features/ ./features/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
