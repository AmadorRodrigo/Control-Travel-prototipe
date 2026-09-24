#!/bin/sh
set -eu

alembic upgrade head
# The in-memory rate limiter requires exactly one worker/replica.
exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${PORT:-8000}" --workers 1 --timeout 60
