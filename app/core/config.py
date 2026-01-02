import os
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./secure_vault.db"

    # Security
    secret_key: str  # Must be set in env
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Encryption
    encryption_key: str  # 32-byte key for AES-256, must be set in env

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("encryption_key")
    @classmethod
    def validate_encryption_key(cls, v):
        if len(v) != 44:  # Fernet key is 32 bytes base64 encoded
            raise ValueError("Encryption key must be 44 characters (32 bytes base64 encoded)")
        return v

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters")
        return v


settings = Settings()