from typing import List

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    resource_type = Column(String, nullable=False)  # e.g., "secret", "user"
    action = Column(String, nullable=False)  # e.g., "read", "write", "delete", "rotate"
    effect = Column(String, nullable=False)  # "allow" or "deny"

    # Relationships
    roles = relationship("RolePolicy", back_populates="policy")