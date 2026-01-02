#!/usr/bin/env python3
"""
Seed script to create initial admin user, roles, and policies.
Run after database setup.
"""

import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models import Policy, Role, RolePolicy, User, UserRole


def seed_data():
    db: Session = SessionLocal()
    try:
        # Create admin role
        admin_role = Role(name="admin", description="Administrator role")
        db.add(admin_role)
        db.flush()

        # Create user role
        user_role = Role(name="user", description="Regular user role")
        db.add(user_role)
        db.flush()

        # Create policies
        policies_data = [
            ("admin_users", "user", "read", "allow"),
            ("admin_users_write", "user", "write", "allow"),
            ("admin_roles", "role", "read", "allow"),
            ("admin_roles_write", "role", "write", "allow"),
            ("admin_policies", "policy", "read", "allow"),
            ("admin_policies_write", "policy", "write", "allow"),
            ("user_secrets", "secret", "read", "allow"),
            ("user_secrets_write", "secret", "write", "allow"),
            ("admin_audit", "audit", "read", "allow"),
        ]

        policies = []
        for name, res_type, action, effect in policies_data:
            policy = Policy(name=name, resource_type=res_type, action=action, effect=effect)
            db.add(policy)
            policies.append(policy)
        db.flush()

        # Assign policies to roles
        # Admin gets all policies
        for policy in policies:
            role_policy = RolePolicy(role_id=admin_role.id, policy_id=policy.id)
            db.add(role_policy)

        # User gets user policies
        user_policies = [p for p in policies if p.name.startswith("user_")]
        for policy in user_policies:
            role_policy = RolePolicy(role_id=user_role.id, policy_id=policy.id)
            db.add(role_policy)

        # Create admin user
        admin_user = User(
            username="admin",
            email="admin@example.com",
            hashed_password=get_password_hash("admin123"),
            is_active=True
        )
        db.add(admin_user)
        db.flush()

        # Assign admin role to admin user
        user_role_rel = UserRole(user_id=admin_user.id, role_id=admin_role.id)
        db.add(user_role_rel)

        db.commit()
        print("Seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()