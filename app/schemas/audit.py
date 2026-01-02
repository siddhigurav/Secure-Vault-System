from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: int
    user_id: int
    action: str
    resource_type: str
    resource_id: Optional[int]
    timestamp: datetime
    ip_address: Optional[str]
    details: Optional[str]

    class Config:
        from_attributes = True