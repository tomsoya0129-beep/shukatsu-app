from pathlib import Path
from sqlmodel import SQLModel, Session, create_engine

from .config import settings


def _ensure_sqlite_parent(url: str) -> None:
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "", 1)
        if path.startswith("/"):
            try:
                Path(path).parent.mkdir(parents=True, exist_ok=True)
            except (PermissionError, OSError):
                # Parent directory unavailable at import time (e.g. during
                # deploy-time build where /data is not mounted yet). DB init
                # will happen later at runtime inside the container.
                pass


_ensure_sqlite_parent(settings.database_url)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=connect_args)


def init_db() -> None:
    from . import models  # noqa: F401  ensure models are imported
    SQLModel.metadata.create_all(engine)
    # SQLite-only schema patches for legacy DBs (no-op on Postgres etc.).
    if engine.dialect.name == "sqlite":
        _migrate()


def _migrate() -> None:
    """Idempotent column additions for SQLite."""
    with engine.connect() as conn:

        def col_exists(table: str, col: str) -> bool:
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            return any(r[1] == col for r in rows)

        def index_exists(name: str) -> bool:
            rows = conn.exec_driver_sql(
                f"SELECT name FROM sqlite_master WHERE type='index' AND name='{name}'"
            ).fetchall()
            return bool(rows)

        if not col_exists("users", "notification_prefs"):
            conn.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN notification_prefs TEXT NOT NULL DEFAULT "
                "'{\"email_enabled\":true,\"deadline_3d\":true,\"deadline_1d\":true,\"interview_1d\":true,\"submission_3d\":true,\"submission_1d\":true,\"offer_3d\":true,\"offer_1d\":true}'"
            )

        # Internship time fields + briefing
        for col in (
            "entry_deadline_time",
            "start_time",
            "end_time",
            "briefing_time",
        ):
            if not col_exists("internships", col):
                conn.exec_driver_sql(
                    f"ALTER TABLE internships ADD COLUMN {col} TEXT"
                )
        if not col_exists("internships", "briefing_date"):
            conn.exec_driver_sql(
                "ALTER TABLE internships ADD COLUMN briefing_date DATE"
            )

        # Selection aptitude deadline + entry deadline time
        for col in ("entry_deadline_time", "aptitude_deadline_time"):
            if not col_exists("selections", col):
                conn.exec_driver_sql(
                    f"ALTER TABLE selections ADD COLUMN {col} TEXT"
                )
        if not col_exists("selections", "aptitude_deadline"):
            conn.exec_driver_sql(
                "ALTER TABLE selections ADD COLUMN aptitude_deadline DATE"
            )

        # Selection/Internship step meeting code + password
        for tbl in ("selection_steps", "internship_steps"):
            for col in ("meeting_code", "meeting_password"):
                if not col_exists(tbl, col):
                    conn.exec_driver_sql(
                        f"ALTER TABLE {tbl} ADD COLUMN {col} TEXT"
                    )

        # Manual sort order for top-level lists
        for tbl in ("companies", "internships", "selections"):
            if not col_exists(tbl, "sort_order"):
                conn.exec_driver_sql(
                    f"ALTER TABLE {tbl} ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
                )

        # Step start_date / start_time (ES/適性検査 の期間モード用)
        for tbl in ("selection_steps", "internship_steps"):
            if not col_exists(tbl, "start_date"):
                conn.exec_driver_sql(
                    f"ALTER TABLE {tbl} ADD COLUMN start_date DATE"
                )
            if not col_exists(tbl, "start_time"):
                conn.exec_driver_sql(
                    f"ALTER TABLE {tbl} ADD COLUMN start_time TEXT"
                )

        # Ensure hot-path indexes on the reminders table. create_all() above
        # already adds them for fresh installs, but we create-if-missing here
        # for older DBs that existed before these indexes were declared.
        for idx_name, ddl in (
            (
                "ix_reminders_remind_at",
                "CREATE INDEX IF NOT EXISTS ix_reminders_remind_at ON reminders(remind_at)",
            ),
            (
                "ix_reminders_sent",
                "CREATE INDEX IF NOT EXISTS ix_reminders_sent ON reminders(sent)",
            ),
            (
                "ix_reminders_channel",
                "CREATE INDEX IF NOT EXISTS ix_reminders_channel ON reminders(channel)",
            ),
        ):
            if not index_exists(idx_name):
                conn.exec_driver_sql(ddl)

        if hasattr(conn, "commit"):
            conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
