from __future__ import annotations

from pathlib import Path
from typing import ClassVar, List, Optional, Set

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "AccelerateZero"
    APP_VERSION: str = "2.0.0"
    APP_ENV: str = Field(default="development", pattern="^(development|staging|production)$")
    DEBUG: bool = False

    SECRET_KEY: str = Field(default="")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    CORS_ORIGINS: List[str] = ["http://localhost:8000"]
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    REDIS_URL: Optional[str] = None

    RATE_LIMIT_DEFAULT: int = 200
    RATE_LIMIT_LOGIN: int = 10
    RATE_LIMIT_REGISTER: int = 5
    RATE_LIMIT_SOS: int = 5
    RATE_LIMIT_UPLOAD: int = 20
    RATE_LIMIT_WINDOW: int = 60

    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024
    MAX_USER_STORAGE: int = 100 * 1024 * 1024
    ALLOWED_EXTENSIONS: Set[str] = {
        "jpg", "jpeg", "png", "gif", "webp",
        "mp4", "webm", "mp3", "wav", "ogg",
    }

    OLLAMA_API_KEY: Optional[str] = None
    OLLAMA_API_BASE: str = "https://ollama.com/v1"
    AI_MODEL: str = "nemotron-3-super:cloud"

    BOOTSTRAP_ADMIN_TOKEN: Optional[str] = None
    LOGIN_LOCKOUT_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    PRIVILEGED_ROLES: List[str] = ["admin", "authority", "emergency"]

    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    LOG_FORMAT: str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    ROOT_DIR: ClassVar[Path] = Path(__file__).resolve().parent.parent.parent.parent
    UPLOAD_PATH: ClassVar[Path] = Path(ROOT_DIR) / "uploads"

    @field_validator("CORS_ORIGINS", "ALLOWED_HOSTS", mode="before")
    @classmethod
    def _parse_list(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v or []

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, v: str) -> str:
        if v and len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    def validate_production(self) -> None:
        if self.APP_ENV != "production":
            return
        if not self.SECRET_KEY:
            raise RuntimeError("SECRET_KEY must be set in production")
        if not self.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY must be set in production")
        if self.CORS_ORIGINS == ["*"]:
            raise RuntimeError("CORS_ORIGINS cannot be wildcard in production")


settings = Settings()

if settings.APP_ENV == "production":
    settings.validate_production()
