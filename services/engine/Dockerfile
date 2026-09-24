# syntax=docker/dockerfile:1
# Engine image: Python 3.12 (pinned, D-16) with the Hyperon runtime in-process (D-01).

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv
COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /uvx /bin/
WORKDIR /app

# Install dependencies first so source edits do not invalidate the layer.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY seed ./seed
# Migrations ship in the image so the release command is `alembic upgrade head` (D-17, D-27).
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
# The Showcase demo seed (#107) runs from the compose `seed` service after migrations.
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN groupadd --system app && useradd --system --gid app --home /app app
USER app

EXPOSE 8000
ENV PATH="/opt/venv/bin:$PATH"
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status == 200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
