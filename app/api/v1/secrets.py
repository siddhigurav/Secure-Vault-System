from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import User
from app.schemas.secret import SecretCreate, SecretRead, SecretReveal, SecretUpdate
from app.services.auth_service import get_current_active_user
from app.services.secret_service import (
    create_secret,
    delete_secret,
    get_secret,
    list_secrets,
    reveal_secret,
    rotate_secret,
)

router = APIRouter()


@router.post("/secrets", response_model=SecretRead)
def create_new_secret(
    secret_data: SecretCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        return create_secret(db, secret_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/secrets", response_model=List[SecretRead])
def get_secrets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return list_secrets(db, current_user.id)


@router.get("/secrets/{secret_id}", response_model=SecretRead)
def get_secret_by_id(
    secret_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        return get_secret(db, secret_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/secrets/{secret_id}/reveal", response_model=SecretReveal)
def reveal_secret_value(
    secret_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        return reveal_secret(db, secret_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/secrets/{secret_id}/rotate", response_model=SecretRead)
def rotate_secret_version(
    secret_id: int,
    update_data: SecretUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        return rotate_secret(db, secret_id, update_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/secrets/{secret_id}")
def delete_secret_by_id(
    secret_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    try:
        delete_secret(db, secret_id, current_user.id)
        return {"message": "Secret deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))