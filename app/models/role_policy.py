from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.base import Base


class RolePolicy(Base):
    __tablename__ = "role_policies"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)

    # Relationships
    role = relationship("Role", back_populates="policies")
    policy = relationship("Policy", back_populates="roles")