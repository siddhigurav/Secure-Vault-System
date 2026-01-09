from datetime import datetime, timedelta
from typing import Any, Union, Tuple
import os
import base64

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Master Key Encryption Key (KEK) - loaded from env
_master_key = Fernet(settings.master_encryption_key.encode())


def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def hash_refresh_token(token: str) -> str:
    """Hash refresh token before storing in DB"""
    return pwd_context.hash(token)


def verify_refresh_token(token: str, hashed_token: str) -> bool:
    """Verify refresh token against hashed version"""
    return pwd_context.verify(token, hashed_token)


def generate_data_encryption_key() -> Tuple[str, str]:
    """
    Generate a new Data Encryption Key (DEK) and return (DEK, encrypted_DEK)
    DEK is encrypted with the master key (KEK) for storage
    """
    # Generate random 32-byte DEK
    dek = base64.urlsafe_b64encode(os.urandom(32)).decode()

    # Encrypt DEK with master key
    encrypted_dek = _master_key.encrypt(dek.encode()).decode()

    return dek, encrypted_dek


def encrypt_secret_with_dek(plaintext: str, dek: str) -> str:
    """Encrypt secret using Data Encryption Key"""
    fernet = Fernet(dek.encode())
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_secret_with_dek(ciphertext: str, dek: str) -> str:
    """Decrypt secret using Data Encryption Key"""
    fernet = Fernet(dek.encode())
    return fernet.decrypt(ciphertext.encode()).decode()


def encrypt_secret(plaintext: str) -> Tuple[str, str]:
    """
    Envelope encryption: Generate DEK, encrypt secret with DEK, encrypt DEK with KEK
    Returns (encrypted_secret, encrypted_dek)
    """
    dek, encrypted_dek = generate_data_encryption_key()
    encrypted_secret = encrypt_secret_with_dek(plaintext, dek)
    return encrypted_secret, encrypted_dek


def decrypt_secret(encrypted_secret: str, encrypted_dek: str) -> str:
    """
    Envelope decryption: Decrypt DEK with KEK, then decrypt secret with DEK
    """
    # Decrypt DEK using master key
    dek = _master_key.decrypt(encrypted_dek.encode()).decode()

    # Decrypt secret using DEK
    return decrypt_secret_with_dek(encrypted_secret, dek)


def rotate_encryption_key(old_encrypted_dek: str, new_master_key: str = None) -> str:
    """
    Rotate encryption key by re-encrypting DEK with new master key
    If new_master_key is None, uses current master key (for key rotation)
    """
    master_key = Fernet((new_master_key or settings.master_encryption_key).encode())

    # Decrypt DEK with old master key
    dek = _master_key.decrypt(old_encrypted_dek.encode()).decode()

    # Re-encrypt with new master key
    return master_key.encrypt(dek.encode()).decode()