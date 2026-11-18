"""Governance Policy Pydantic V2 Schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel


class PolicyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: str | None = None
    tool_id: UUID | None = None
    tool_name_pattern: str = Field(default="*", max_length=128)
    operation: str | None = None
    risk_level: RiskLevel | None = None
    decision: PolicyDecision = PolicyDecision.DENY
    conditions: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=100, ge=1, le=10000)
    is_enabled: bool = True


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    description: str | None = None
    tool_id: UUID | None = None
    tool_name_pattern: str | None = None
    operation: str | None = None
    risk_level: RiskLevel | None = None
    decision: PolicyDecision | None = None
    conditions: dict[str, Any] | None = None
    priority: int | None = Field(default=None, ge=1, le=10000)
    is_enabled: bool | None = None


class PolicyResponse(PolicyBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PolicyEvaluationRequest(BaseModel):
    tool_name: str
    operation: str | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)
    agent_id: UUID | None = None
    risk_level: RiskLevel | None = None


class PolicyEvaluationResult(BaseModel):
    decision: PolicyDecision
    policy_id: UUID | None = None
    policy_name: str | None = None
    reason: str
    risk_level: RiskLevel
