FROM ghcr.io/astral-sh/uv:0.8-python3.12-bookworm-slim AS builder
WORKDIR /app
COPY apps/soc/backend/pyproject.toml apps/soc/backend/uv.lock* ./
RUN uv sync --no-dev --no-cache || uv pip install --system --no-cache -r pyproject.toml

FROM python:3.12-slim
WORKDIR /app
RUN useradd --create-home --uid 1000 appuser
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"
COPY apps/soc/backend/core ./core
COPY apps/soc/backend/domain ./domain
COPY apps/soc/backend/application ./application
COPY apps/soc/backend/adapters ./adapters
COPY apps/soc/backend/features ./features
COPY apps/soc/backend/main.py ./main.py
USER appuser
EXPOSE 8002
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
