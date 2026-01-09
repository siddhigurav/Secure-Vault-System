from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, verify_password, hash_refresh_token
from app.db.session import get_db
from app.models import User, RefreshToken
from app.schemas.auth import Token, TokenData, UserLogin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/login")


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def login_user(db: Session, username: str, password: str) -> Token:
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Store hashed refresh token in database
    hashed_refresh_token = hash_refresh_token(refresh_token)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        hashed_token=hashed_refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    )
    db.add(db_refresh_token)
    db.commit()
    db.refresh(db_refresh_token)
    
    return Token(access_token=access_token, refresh_token=refresh_token)


def refresh_access_token(db: Session, refresh_token: str) -> Token:
    try:
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "refresh":
            raise JWTError
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify refresh token exists in database and is not revoked
    hashed_token = hash_refresh_token(refresh_token)
    stored_token = db.query(RefreshToken).filter(
        RefreshToken.user_id == int(user_id),
        RefreshToken.hashed_token == hashed_token,
        RefreshToken.revoked == False
    ).first()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Revoke the old refresh token
    stored_token.revoked = True
    db.commit()
    
    # Create new tokens
    access_token = create_access_token(subject=user_id)
    new_refresh_token = create_refresh_token(subject=user_id)
    
    # Store new hashed refresh token
    hashed_new_refresh_token = hash_refresh_token(new_refresh_token)
    db_new_refresh_token = RefreshToken(
        user_id=int(user_id),
        hashed_token=hashed_new_refresh_token,
        expires_at=settings.refresh_token_expire_days
    )
    db.add(db_new_refresh_token)
    db.commit()
    db.refresh(db_new_refresh_token)
    
    return Token(access_token=access_token, refresh_token=new_refresh_token)


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(token_data.username)).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user