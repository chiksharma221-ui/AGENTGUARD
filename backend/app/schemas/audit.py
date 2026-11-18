"""Audit and Execution Record Pydantic V2 Schemas."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.tool import RiskLevel
from app.models.policy import PolicyDecision
from app.models.approval import DecisionType
from app.models.audit import ExecutionStatus


class ExecutionRecordResponse(BaseModel):
    id: UUID
    request_id: UUID | None = None
    agent_id: UUID
    tool_id: UUID | None = None
    tool_name: str
    arguments_ref: str | None = None
    status: ExecutionStatus
    result_summary: str | None = None
    error_detail: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    duration_ms: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: UUID
    request_id: UUID | None = None
    agent_id: UUID | None = None
    user_id: UUID | None = None
    tool_name: str
    arguments_ref: str | None = None
    policy_decision: PolicyDecision
    risk_level: RiskLevel
    approval_decision: DecisionType | None = None
    execution_status: ExecutionStatus | None = None
    approver_id: UUID | None = None
    ip_address: str | None = None
    prev_hash: str
    row_hash: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogFilter(BaseModel):
    user_id: UUID | None = None
    agent_id: UUID | None = None
    tool_name: str | None = None
    policy_decision: PolicyDecision | None = None
    risk_level: RiskLevel | None = None
    status: ExecutionStatus | None = None
    from_time: datetime | None = None
    to_time: datetime | None = None
    limit: int = Field(default=100, ge=1, le=1000)
    skip: int = Field(default=0, ge=0)


class AuditStatsResponse(BaseModel):
    total_invocations: int
    total_allowed: int
    total_denied: int
    total_pending_approval: int
    total_executed: int
    chain_verified: bool
    risk_breakdown: dict[str, int]
