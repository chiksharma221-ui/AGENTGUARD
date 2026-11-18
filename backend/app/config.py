"""Application Configuration Module."""

import json
from typing import Any, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database & Cache
    DATABASE_URL: str = Field(
        default="postgresql://agentguard:agentguard_pass@localhost:5432/agentguard",
        description="PostgreSQL connection string",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection string",
    )

    # Security & JWT
    SECRET_KEY: str = Field(
        default="your-super-secret-key-change-in-production-min-32-chars-long!",
        description="Secret key for signing tokens and symmetric encryption",
    )
    ALGORITHM: str = Field(
        default="HS256",
        description="JWT hashing algorithm",
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Access token lifespan in minutes",
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Refresh token lifespan in days",
    )

    # Tool Execution & Sandbox
    FILE_SANDBOX_PATH: str = Field(
        default="./sandbox",
        description="Local directory path to restrict filesystem operations to",
    )
    GITHUB_TOKEN: str = Field(
        default="",
        description="Optional GitHub personal access token for GitHub tools",
    )
    OPENAI_API_KEY: str = Field(
        default="",
        description="Optional OpenAI API key for AI agent reasoning",
    )

    # Celery Background Tasks
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Celery message broker URL",
    )
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/0",
        description="Celery task result backend URL",
    )

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="Allowed CORS origins for browser clients",
    )

    # First Admin Bootstrap Account
    FIRST_ADMIN_EMAIL: str = Field(
        default="admin@agentguard.local",
        description="Initial administrator email",
    )
    FIRST_ADMIN_PASSWORD: str = Field(
        default="Admin@123!",
        description="Initial administrator password",
    )
    FIRST_ADMIN_NAME: str = Field(
        default="System Administrator",
        description="Initial administrator display name",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Union[str, list[Any]]) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except Exception:
                    pass
            return [part.strip() for part in value.split(",") if part.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value]
        return ["http://localhost:5173", "http://localhost:3000"]

    @property
    def db_engine_args(self) -> dict[str, Any]:
        """Engine arguments optimized for production connections."""
        args: dict[str, Any] = {
            "pool_pre_ping": True,
            "pool_recycle": 3600,
        }
        if "sqlite" in self.DATABASE_URL.lower():
            args["connect_args"] = {"check_same_thread": False}
        else:
            args["pool_size"] = 10
            args["max_overflow"] = 20
        return args


# Global settings singleton
settings = Settings()
