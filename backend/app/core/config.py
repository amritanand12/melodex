from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    # App
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://melodex:melodex_pass@localhost:5432/melodex"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Storage
    STORAGE_PATH: str = "/app/downloads"
    MAX_FILE_AGE_HOURS: int = 24          # Auto-cleanup after 24h
    MAX_STORAGE_GB: float = 50.0

    # AWS S3 (optional - uses local if not set)
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "us-east-1"
    USE_S3: bool = False

    # Rate limiting
    RATE_LIMIT_PER_IP: int = 30           # requests/minute
    MAX_URLS_PER_REQUEST: int = 50
    MAX_CONCURRENT_DOWNLOADS: int = 20

    # yt-dlp
    YT_DLP_COOKIES_FILE: str = ""         # Optional: path to cookies.txt
    YT_DLP_PROXY: str = ""                # Optional: proxy URL

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost"]

    # Monitoring
    SENTRY_DSN: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
