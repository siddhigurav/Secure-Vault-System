from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.permissions import require_permission
from app.db.session import get_db
from app.schemas.audit import AuditLogRead
from app.services.audit_service import get_audit_logs
from app.services.auth_service import get_current_active_user

router = APIRouter()


@router.get("/audit/logs", response_model=List[AuditLogRead])
def list_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    require_permission(db, current_user.id, "audit", "read")
    return get_audit_logs(db, current_user.id, limit)