FROM ghcr.io/astral-sh/uv:0.8-python3.12-bookworm-slim AS builder
WORKDIR /app
# No glob on uv.lock: the lock is what makes this build reproducible, and a
# missing one should fail here rather than silently resolve something else.
COPY apps/soc/backend/pyproject.toml apps/soc/backend/uv.lock ./
# --frozen refuses to update the lock, so the image gets exactly what the lock
# pins. No fallback: the previous "|| uv pip install --system" installed into
# the system interpreter, so if it ever fired, /app/.venv would not exist and
# the COPY below would fail with an error about the wrong thing.
RUN uv sync --frozen --no-dev --no-cache

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
