from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import get_current_active_user

router = APIRouter()


@router.post("/users", response_model=UserRead)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Assume admin permission
    require_permission(db, current_user.id, "user", "write")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=user_data.is_active
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_orm(user)


@router.get("/users/me", response_model=UserRead)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    return UserRead.from_orm(current_user)


@router.get("/users", response_model=List[UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "user", "read")
    users = db.query(User).all()
    return [UserRead.from_orm(u) for u in users]


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "user", "read")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserRead.from_orm(user)


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "user", "write")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update_data.email and db.query(User).filter(User.email == update_data.email, User.id != user_id).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserRead.from_orm(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "user", "delete")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}