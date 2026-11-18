"""Human Approval Pydantic V2 Schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.approval import ApprovalStatus, DecisionType
from app.models.tool import RiskLevel


class ApprovalDecisionCreate(BaseModel):
    decision: DecisionType
    comment: str | None = Field(default=None, max_length=1000)


class ApprovalDecisionResponse(BaseModel):
    id: UUID
    request_id: UUID
    approver_id: UUID
    decision: DecisionType
    comment: str | None = None
    decided_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApprovalRequestResponse(BaseModel):
    id: UUID
    request_hash: str
    tool_id: UUID | None = None
    agent_id: UUID
    requested_by_user_id: UUID | None = None
    arguments_hash: str
    arguments: dict[str, Any] | None = None  # Populated when decrypted for UI view
    tool_name: str
    status: ApprovalStatus
    risk_level: RiskLevel
    reason: str | None = None
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    decision: ApprovalDecisionResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class ApprovalListResponse(BaseModel):
    total: int
    items: list[ApprovalRequestResponse]
