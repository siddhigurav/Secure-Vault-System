from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import User, Policy, Role, UserRole, RolePolicy


class PolicyService:
    def __init__(self, db: Session):
        self.db = db

    def evaluate_permission(self, user: User, resource_type: str, action: str, resource_id: Optional[int] = None) -> bool:
        """
        Evaluate if a user has permission to perform an action on a resource.
        
        Args:
            user: The user to check permissions for
            resource_type: Type of resource (e.g., "secret", "user")
            action: Action to perform (e.g., "read", "write", "delete", "rotate")
            resource_id: Optional specific resource ID for resource-level permissions
            
        Returns:
            True if the user has permission, False otherwise
        """
        # Get all policies for the user's roles
        user_policies = self._get_user_policies(user)
        
        # Check for explicit deny first (deny takes precedence)
        for policy in user_policies:
            if (policy.resource_type == resource_type and 
                policy.action == action and 
                policy.effect == "deny"):
                return False
        
        # Check for allow
        for policy in user_policies:
            if (policy.resource_type == resource_type and 
                policy.action == action and 
                policy.effect == "allow"):
                return True
        
        # Default deny if no matching policy
        return False

    def _get_user_policies(self, user: User) -> List[Policy]:
        """
        Get all policies associated with a user's roles.
        """
        policies = []
        
        # Get user's roles
        user_roles = self.db.query(UserRole).filter(UserRole.user_id == user.id).all()
        
        for user_role in user_roles:
            # Get policies for each role
            role_policies = self.db.query(RolePolicy).filter(RolePolicy.role_id == user_role.role_id).all()
            
            for role_policy in role_policies:
                policy = self.db.query(Policy).filter(Policy.id == role_policy.policy_id).first()
                if policy:
                    policies.append(policy)
        
        return policies

    def get_user_permissions(self, user: User) -> List[dict]:
        """
        Get a summary of all permissions for a user.
        
        Returns:
            List of dictionaries with resource_type, action, and effect
        """
        policies = self._get_user_policies(user)
        permissions = []
        
        for policy in policies:
            permissions.append({
                "resource_type": policy.resource_type,
                "action": policy.action,
                "effect": policy.effect
            })
        
        return permissions