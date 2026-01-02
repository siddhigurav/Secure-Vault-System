#!/usr/bin/env python3
"""
Create database tables script.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.db.base import Base
from app.db.session import engine

# Import all models to ensure they are registered with Base
from app.models.audit import AuditLog
from app.models.policy import Policy
from app.models.role import Role
from app.models.role_policy import RolePolicy
from app.models.secret import Secret, SecretVersion
from app.models.user import User
from app.models.user_role import UserRole

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    create_tables()