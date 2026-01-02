from datetime import datetime
from typing import List

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Secret(Base):
    __tablename__ = "secrets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    path = Column(String, unique=True, index=True, nullable=False)  # e.g., /api-keys/stripe
    current_version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    created_by_user = relationship("User", back_populates="secrets_created")
    versions = relationship("SecretVersion", back_populates="secret", order_by="SecretVersion.version")


class SecretVersion(Base):
    __tablename__ = "secret_versions"

    id = Column(Integer, primary_key=True, index=True)
    secret_id = Column(Integer, ForeignKey("secrets.id"), nullable=False)
    version = Column(Integer, nullable=False)
    encrypted_value = Column(Text, nullable=False)  # Encrypted data
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    secret = relationship("Secret", back_populates="versions")
    created_by_user = relationship("User")  # No back_populates needed if not used