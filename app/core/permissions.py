from typing import List

from sqlalchemy.orm import Session

from app.models import Policy, Role, RolePolicy, User, UserRole


def get_user_roles(db: Session, user_id: int) -> List[Role]:
    """Get all roles for a user"""
    user_roles = (
        db.query(Role)
        .join(UserRole)
        .filter(UserRole.user_id == user_id)
        .all()
    )
    return user_roles


def get_role_policies(db: Session, role_id: int) -> List[Policy]:
    """Get all policies for a role"""
    policies = (
        db.query(Policy)
        .join(RolePolicy)
        .filter(RolePolicy.role_id == role_id)
        .all()
    )
    return policies


def check_permission(db: Session, user_id: int, resource_type: str, action: str) -> bool:
    """
    Check if user has permission to perform action on resource_type.
    Returns True if allowed, False otherwise (deny-by-default).
    """
    roles = get_user_roles(db, user_id)
    for role in roles:
        policies = get_role_policies(db, role.id)
        for policy in policies:
            if (
                policy.resource_type == resource_type
                and policy.action == action
                and policy.effect == "allow"
            ):
                return True
            # If deny, could return False, but for simplicity, allow takes precedence
    return False


def require_permission(db: Session, user_id: int, resource_type: str, action: str) -> None:
    """Raise exception if permission denied"""
    if not check_permission(db, user_id, resource_type, action):
        raise PermissionError(f"Access denied: no permission for {action} on {resource_type}")