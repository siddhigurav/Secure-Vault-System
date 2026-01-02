from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SecretBase(BaseModel):
    name: str
    path: str


class SecretCreate(SecretBase):
    value: str


class SecretUpdate(BaseModel):
    name: Optional[str] = None
    value: Optional[str] = None  # For rotation


class Secret(SecretBase):
    id: int
    current_version: int
    created_at: datetime
    updated_at: datetime
    created_by: int

    class Config:
        from_attributes = True


class SecretRead(Secret):
    # Masked value
    value: str = "***masked***"


class SecretReveal(Secret):
    value: str