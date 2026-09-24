import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.core.rate_limit import rate_limiter
from app.models import IdempotencyKey, PasswordResetToken, RefreshSession


logger = logging.getLogger(__name__)


def cleanup_expired_records() -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        for model in (RefreshSession, IdempotencyKey, PasswordResetToken):
            db.execute(delete(model).where(model.expires_at <= now))


async def run_maintenance() -> None:
    elapsed_minutes = 0
    while True:
        await asyncio.sleep(60)
        rate_limiter.cleanup()
        elapsed_minutes += 1
        if elapsed_minutes >= 60:
            try:
                await asyncio.to_thread(cleanup_expired_records)
            except SQLAlchemyError:
                # Do not log SQL parameters, which could contain sensitive data.
                logger.error("Expired-record cleanup failed; retrying in one hour")
            elapsed_minutes = 0
