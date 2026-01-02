import pytest
from sqlalchemy.orm import Session

from app.services.auth_service import authenticate_user


def test_authenticate_user_success(db: Session, test_user):
    user = authenticate_user(db, "testuser", "password")
    assert user is not None
    assert user.username == "testuser"


def test_authenticate_user_wrong_password(db: Session, test_user):
    user = authenticate_user(db, "testuser", "wrong")
    assert user is None


def test_authenticate_user_not_found(db: Session):
    user = authenticate_user(db, "nonexistent", "password")
    assert user is None