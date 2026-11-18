"""Audit Log and Tool Execution Record Models."""

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.tool import RiskLevel
from app.models.policy import PolicyDecision
from app.models.approval import DecisionType


class ExecutionStatus(str, enum.Enum):
    """Terminal and intermediate statuses for tool executions."""

    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    DENIED = "DENIED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class ExecutionRecord(Base):
    """Comprehensive record of a tool invocation execution attempt."""

    __tablename__ = "execution_records"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    request_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("approval_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    agent_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tools.id", ondelete="SET NULL"),
        nullable=True,
    )
    tool_name = Column(String(128), nullable=False, index=True)
    arguments_ref = Column(Text, nullable=True)
    status = Column(
        SQLEnum(ExecutionStatus, name="execution_status_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    result_summary = Column(Text, nullable=True)
    error_detail = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    agent = relationship("Agent", foreign_keys=[agent_id])
    tool = relationship("Tool", foreign_keys=[tool_id])
    approval_request = relationship("ApprovalRequest", foreign_keys=[request_id])


class AuditLog(Base):
    """Tamper-evident, cryptographically chained audit log of all gateway decisions."""

    __tablename__ = "audit_logs"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    request_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    agent_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    user_id = Column(Uuid(as_uuid=True), nullable=True, index=True)
    tool_name = Column(String(128), nullable=False, index=True)
    arguments_ref = Column(Text, nullable=True)
    policy_decision = Column(
        SQLEnum(PolicyDecision, name="policy_decision_enum", native_enum=False),
        nullable=False,
    )
    risk_level = Column(
        SQLEnum(RiskLevel, name="risk_level_enum", native_enum=False),
        nullable=False,
    )
    approval_decision = Column(
        SQLEnum(DecisionType, name="decision_type_enum", native_enum=False),
        nullable=True,
    )
    execution_status = Column(
        SQLEnum(ExecutionStatus, name="execution_status_enum", native_enum=False),
        nullable=True,
    )
    approver_id = Column(Uuid(as_uuid=True), nullable=True)
    ip_address = Column(String(64), nullable=True)
    prev_hash = Column(String(64), nullable=False)
    row_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
