from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.auth import RefreshToken, Token, UserLogin
from app.services.auth_service import login_user, refresh_access_token

router = APIRouter()


@router.post("/auth/login", response_model=Token)
def login(user_login: UserLogin, db: Session = Depends(get_db)):
    return login_user(db, user_login)


@router.post("/auth/refresh", response_model=Token)
def refresh_token(refresh_data: RefreshToken):
    return refresh_access_token(refresh_data.refresh_token)