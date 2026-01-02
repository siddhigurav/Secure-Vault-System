import pytest
from sqlalchemy.orm import Session

from app.services.secret_service import create_secret, get_secret


def test_create_secret(db: Session, test_user):
    secret_data = {"name": "test_secret", "path": "/test", "value": "secret_value"}
    secret = create_secret(db, secret_data, test_user.id)
    assert secret.name == "test_secret"
    assert secret.path == "/test"


def test_get_secret(db: Session, test_user, test_secret):
    secret = get_secret(db, test_secret.id, test_user.id)
    assert secret.name == "test_secret"
    assert secret.value == "***masked***"