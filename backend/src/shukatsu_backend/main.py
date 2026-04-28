"""FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import auth as auth_router
from .routers import calendar as calendar_router
from .routers import companies as companies_router
from .routers import imports as imports_router
from .routers import internships as internships_router
from .routers import notifications as notifications_router
from .routers import reminders as reminders_router
from .routers import selections as selections_router
from . import scheduler as scheduler_mod


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Replaces the deprecated @app.on_event startup/shutdown hooks."""
    init_db()
    scheduler_mod.start()
    try:
        yield
    finally:
        scheduler_mod.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Shukatsu App API",
        description="Internship & job-hunting information management backend",
        version="0.1.0",
        lifespan=_lifespan,
    )

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    for r in (
        auth_router.router,
        companies_router.router,
        internships_router.router,
        selections_router.router,
        calendar_router.router,
        reminders_router.router,
        notifications_router.router,
        notifications_router.cron_router,
        imports_router.router,
    ):
        app.include_router(r)

    return app


app = create_app()
