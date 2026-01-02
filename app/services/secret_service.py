from typing import List

from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.core.security import decrypt_secret, encrypt_secret
from app.models import Secret, SecretVersion, User
from app.schemas.secret import SecretCreate, SecretRead, SecretReveal, SecretUpdate


def create_secret(db: Session, secret_data: SecretCreate, created_by: int) -> Secret:
    require_permission(db, created_by, "secret", "write")
    # Check if path exists
    existing = db.query(Secret).filter(Secret.path == secret_data.path).first()
    if existing:
        raise ValueError("Secret path already exists")
    
    encrypted_value = encrypt_secret(secret_data.value)
    secret = Secret(
        name=secret_data.name,
        path=secret_data.path,
        created_by=created_by,
        current_version=1
    )
    db.add(secret)
    db.flush()  # To get id
    
    version = SecretVersion(
        secret_id=secret.id,
        version=1,
        encrypted_value=encrypted_value,
        created_by=created_by,
        is_active=True
    )
    db.add(version)
    db.commit()
    db.refresh(secret)
    return secret


def get_secret(db: Session, secret_id: int, user_id: int) -> SecretRead:
    require_permission(db, user_id, "secret", "read")
    secret = db.query(Secret).filter(Secret.id == secret_id).first()
    if not secret:
        raise ValueError("Secret not found")
    return SecretRead.from_orm(secret)


def reveal_secret(db: Session, secret_id: int, user_id: int) -> SecretReveal:
    require_permission(db, user_id, "secret", "read")  # Or specific reveal permission
    secret = db.query(Secret).filter(Secret.id == secret_id).first()
    if not secret:
        raise ValueError("Secret not found")
    # Get current version
    current_version = (
        db.query(SecretVersion)
        .filter(SecretVersion.secret_id == secret_id, SecretVersion.is_active == True)
        .first()
    )
    if not current_version:
        raise ValueError("No active version found")
    plaintext = decrypt_secret(current_version.encrypted_value)
    return SecretReveal(
        id=secret.id,
        name=secret.name,
        path=secret.path,
        current_version=secret.current_version,
        created_at=secret.created_at,
        updated_at=secret.updated_at,
        created_by=secret.created_by,
        value=plaintext
    )


def rotate_secret(db: Session, secret_id: int, update_data: SecretUpdate, user_id: int) -> Secret:
    require_permission(db, user_id, "secret", "rotate")
    secret = db.query(Secret).filter(Secret.id == secret_id).first()
    if not secret:
        raise ValueError("Secret not found")
    if not update_data.value:
        raise ValueError("New value required for rotation")
    
    # Deactivate current version
    db.query(SecretVersion).filter(
        SecretVersion.secret_id == secret_id, SecretVersion.is_active == True
    ).update({"is_active": False})
    
    # Create new version
    new_version_num = secret.current_version + 1
    encrypted_value = encrypt_secret(update_data.value)
    version = SecretVersion(
        secret_id=secret.id,
        version=new_version_num,
        encrypted_value=encrypted_value,
        created_by=user_id,
        is_active=True
    )
    db.add(version)
    secret.current_version = new_version_num
    db.commit()
    db.refresh(secret)
    return secret


def list_secrets(db: Session, user_id: int) -> List[SecretRead]:
    require_permission(db, user_id, "secret", "read")
    secrets = db.query(Secret).all()
    return [SecretRead.from_orm(s) for s in secrets]


def delete_secret(db: Session, secret_id: int, user_id: int) -> None:
    require_permission(db, user_id, "secret", "delete")
    secret = db.query(Secret).filter(Secret.id == secret_id).first()
    if not secret:
        raise ValueError("Secret not found")
    db.delete(secret)
    db.commit()