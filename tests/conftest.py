import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models import User, Role, UserRole, Secret, SecretVersion
from app.core.security import get_password_hash


@pytest.fixture(scope="session")
def engine():
    """Create in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="session")
def session_factory(engine):
    """Create session factory"""
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db(session_factory):
    """Create database session for each test"""
    session = session_factory()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def test_role(db: Session):
    """Create a test role"""
    # Check if role already exists
    existing_role = db.query(Role).filter(Role.name == "test_role").first()
    if existing_role:
        return existing_role
    
    role = Role(name="test_role", description="Test role")
    db.add(role)
    db.commit()
    db.refresh(role)
    
    # Add policies for secret operations
    from app.models import Policy, RolePolicy
    
    policies_data = [
        ("test_secret_read", "secret", "read", "allow"),
        ("test_secret_write", "secret", "write", "allow"),
    ]
    
    for name, res_type, action, effect in policies_data:
        policy = Policy(name=name, resource_type=res_type, action=action, effect=effect)
        db.add(policy)
        db.commit()
        db.refresh(policy)
        
        role_policy = RolePolicy(role_id=role.id, policy_id=policy.id)
        db.add(role_policy)
        db.commit()
    
    return role


@pytest.fixture(scope="function")
def test_user(db: Session, test_role):
    """Create a test user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == "testuser").first()
    if existing_user:
        return existing_user
    
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password"),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Assign role to user
    user_role = UserRole(user_id=user.id, role_id=test_role.id)
    db.add(user_role)
    db.commit()

    return user


@pytest.fixture(scope="function")
def test_secret(db: Session, test_user):
    """Create a test secret"""
    # Check if secret already exists
    existing_secret = db.query(Secret).filter(Secret.name == "test_secret").first()
    if existing_secret:
        return existing_secret

    secret = Secret(
        name="test_secret",
        path="/test",
        created_by=test_user.id
    )
    db.add(secret)
    db.commit()
    db.refresh(secret)

    # Create secret version
    from app.core.security import encrypt_secret
    encrypted_value, encrypted_dek = encrypt_secret("secret_value")

    secret_version = SecretVersion(
        secret_id=secret.id,
        version=1,
        encrypted_value=encrypted_value,
        encrypted_dek=encrypted_dek,
        created_by=test_user.id
    )
    db.add(secret_version)
    db.commit()
    db.refresh(secret_version)

    return secret