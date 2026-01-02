from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)  # e.g., "secret_read", "secret_create"
    resource_type = Column(String, nullable=False)  # e.g., "secret"
    resource_id = Column(Integer, nullable=True)  # ID of the resource
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)
    details = Column(Text, nullable=True)  # JSON string for additional info

    # Relationships
    user = relationship("User", back_populates="audit_logs")