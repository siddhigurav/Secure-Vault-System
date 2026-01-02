from typing import Optional

from pydantic import BaseModel


class PolicyBase(BaseModel):
    name: str
    resource_type: str
    action: str
    effect: str


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    resource_type: Optional[str] = None
    action: Optional[str] = None
    effect: Optional[str] = None


class PolicyRead(PolicyBase):
    id: int

    class Config:
        from_attributes = True