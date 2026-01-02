from typing import List, Optional

from sqlalchemy.orm import Session

from app.models import AuditLog
from app.schemas.audit import AuditLogRead  # Assume we have this


def log_action(
    db: Session,
    user_id: int,
    action: str,
    resource_type: str,
    resource_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[str] = None
) -> None:
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        details=details
    )
    db.add(audit_log)
    db.commit()


def get_audit_logs(db: Session, user_id: int, limit: int = 100) -> List[AuditLogRead]:
    # Assume permission check
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [AuditLogRead.from_orm(log) for log in logs]