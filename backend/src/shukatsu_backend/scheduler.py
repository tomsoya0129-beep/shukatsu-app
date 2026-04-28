"""Background scheduler that ticks reminders."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import Session, select

from .config import settings
from .database import engine
from .models import User
from .reminder_service import dispatch_due_reminders, regenerate_for_user


log = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _tick() -> None:
    log.info("scheduler tick running")
    with Session(engine) as session:
        # Only regenerate for users with email; the rest would have nothing
        # to dispatch anyway.
        users = session.exec(select(User).where(User.email.is_not(None))).all()  # type: ignore[union-attr]
        for u in users:
            regenerate_for_user(session, u)
        n = await dispatch_due_reminders(session)
        log.info("scheduler tick emailed_users=%s", n)


def start() -> None:
    global _scheduler
    if _scheduler or not settings.scheduler_enabled:
        return
    _scheduler = AsyncIOScheduler(timezone=settings.scheduler_timezone)
    # Run every morning at 07:00 JST for day-based notifications
    _scheduler.add_job(_tick, CronTrigger(hour=7, minute=0), id="morning-tick")
    # Also run every 5 minutes to dispatch time-based notifications (e.g. 1h-before)
    _scheduler.add_job(_tick, CronTrigger(minute="*/5"), id="fivemin-tick")
    _scheduler.start()
    log.info("APScheduler started (tz=%s)", settings.scheduler_timezone)


def stop() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
