import os
from typing import List

from pydantic import field_validator, ValidationError
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str

    # Security - Required, no defaults
    secret_key: str
    master_encryption_key: str  # KEK for envelope encryption

    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v):
        if not v:
            raise ValueError("DATABASE_URL is required")
        return v

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("master_encryption_key")
    @classmethod
    def validate_master_key(cls, v):
        if len(v) != 44:  # Fernet key is 32 bytes base64 encoded
            raise ValueError("MASTER_ENCRYPTION_KEY must be 44 characters (32 bytes base64 encoded)")
        return v


# Validate settings at startup
try:
    settings = Settings()
except ValidationError as e:
    print(f"Configuration error: {e}")
    print("Please set required environment variables in .env file")
    exit(1)