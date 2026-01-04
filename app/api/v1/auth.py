from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import RefreshToken, Token, UserLogin
from app.services.auth_service import login_user, refresh_access_token

router = APIRouter()


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return login_user(db, form_data.username, form_data.password)


@router.post("/refresh", response_model=Token)
def refresh_token(refresh_data: RefreshToken):
    return refresh_access_token(refresh_data.refresh_token)