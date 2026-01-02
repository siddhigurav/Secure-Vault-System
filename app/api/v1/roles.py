from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.db.session import get_db
from app.models import Role
from app.schemas.role import RoleCreate, RoleRead, RoleUpdate
from app.services.auth_service import get_current_active_user

router = APIRouter()


@router.post("/roles", response_model=RoleRead)
def create_role(
    role_data: RoleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "role", "write")
    if db.query(Role).filter(Role.name == role_data.name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")
    
    role = Role(name=role_data.name, description=role_data.description)
    db.add(role)
    db.commit()
    db.refresh(role)
    return RoleRead.from_orm(role)


@router.get("/roles", response_model=List[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "role", "read")
    roles = db.query(Role).all()
    return [RoleRead.from_orm(r) for r in roles]


@router.get("/roles/{role_id}", response_model=RoleRead)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "role", "read")
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return RoleRead.from_orm(role)


@router.put("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: int,
    update_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "role", "write")
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(role, field, value)
    db.commit()
    db.refresh(role)
    return RoleRead.from_orm(role)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "role", "delete")
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    db.delete(role)
    db.commit()
    return {"message": "Role deleted"}