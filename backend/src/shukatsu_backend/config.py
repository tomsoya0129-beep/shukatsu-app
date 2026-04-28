from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:////data/shukatsu.db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30

    cors_origins: str = "*"

    # Email: pick one transport. Gmail SMTP takes priority if SMTP_USER set.
    # mail_provider can be "auto" (detect), "gmail", or "resend".
    mail_provider: str = "auto"
    resend_api_key: str | None = None
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str = "就活マネージャー"
    mail_from: str = "Shukatsu App <onboarding@resend.dev>"
    app_public_url: str = "https://dist-razvakxp.devinapps.com"
    cron_secret: str = "change-me-cron"
    scheduler_enabled: bool = True
    scheduler_timezone: str = "Asia/Tokyo"

    # Gemini API for email/screenshot import
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash-lite"


settings = Settings()


def _normalize_db_url(url: str) -> str:
    """Render/Heroku-style ``postgres://`` and ``postgresql://`` URLs work
    against psycopg3, but SQLAlchemy needs the explicit ``+psycopg`` driver
    suffix to pick the right adapter (psycopg2 isn't installed)."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url.split("@", 1)[0]:
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


settings.database_url = _normalize_db_url(settings.database_url)
