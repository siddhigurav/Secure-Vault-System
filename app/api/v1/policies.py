from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models import Policy
from app.schemas.policy import PolicyCreate, PolicyRead, PolicyUpdate
from app.services.auth_service import get_current_active_user

router = APIRouter()


@router.post("/policies", response_model=PolicyRead)
def create_policy(
    policy_data: PolicyCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "policy", "write")
    if db.query(Policy).filter(Policy.name == policy_data.name).first():
        raise HTTPException(status_code=400, detail="Policy name already exists")
    
    policy = Policy(
        name=policy_data.name,
        resource_type=policy_data.resource_type,
        action=policy_data.action,
        effect=policy_data.effect
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return PolicyRead.from_orm(policy)


@router.get("/policies", response_model=List[PolicyRead])
def list_policies(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "policy", "read")
    policies = db.query(Policy).all()
    return [PolicyRead.from_orm(p) for p in policies]


@router.get("/policies/{policy_id}", response_model=PolicyRead)
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "policy", "read")
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return PolicyRead.from_orm(policy)


@router.put("/policies/{policy_id}", response_model=PolicyRead)
def update_policy(
    policy_id: int,
    update_data: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "policy", "write")
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    return PolicyRead.from_orm(policy)


@router.delete("/policies/{policy_id}")
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "policy", "delete")
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.commit()
    return {"message": "Policy deleted"}