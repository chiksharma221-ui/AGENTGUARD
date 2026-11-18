"""Human-in-the-Loop Approval Request and Decision Models."""

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.tool import RiskLevel


class ApprovalStatus(str, enum.Enum):
    """Lifecycle statuses for human-in-the-loop approval workflows."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    EXECUTING = "EXECUTING"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"


class DecisionType(str, enum.Enum):
    """Decision options for an approver."""

    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApprovalRequest(Base):
    """Pending or concluded request for administrative execution approval."""

    __tablename__ = "approval_requests"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    request_hash = Column(String(64), unique=True, index=True, nullable=False)
    tool_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tools.id", ondelete="SET NULL"),
        nullable=True,
    )
    agent_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_user_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    arguments_hash = Column(String(64), nullable=False)
    arguments_encrypted = Column(Text, nullable=False)
    tool_name = Column(String(128), nullable=False, index=True)
    status = Column(
        SQLEnum(ApprovalStatus, name="approval_status_enum", native_enum=False),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )
    risk_level = Column(
        SQLEnum(RiskLevel, name="risk_level_enum", native_enum=False),
        nullable=False,
        default=RiskLevel.MEDIUM,
    )
    reason = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    agent = relationship("Agent", foreign_keys=[agent_id])
    tool = relationship("Tool", foreign_keys=[tool_id])
    requested_by_user = relationship("User", foreign_keys=[requested_by_user_id])
    decision = relationship(
        "ApprovalDecision",
        uselist=False,
        back_populates="request",
        cascade="all, delete-orphan",
    )


class ApprovalDecision(Base):
    """Audit record capturing the explicit verdict of an approver."""

    __tablename__ = "approval_decisions"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    request_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("approval_requests.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    approver_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    decision = Column(
        SQLEnum(DecisionType, name="decision_type_enum", native_enum=False),
        nullable=False,
    )
    comment = Column(Text, nullable=True)
    decided_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    request = relationship("ApprovalRequest", back_populates="decision")
    approver = relationship("User", foreign_keys=[approver_id])
