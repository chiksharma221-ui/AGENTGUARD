"""Governance Policy Models."""

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.tool import RiskLevel


class PolicyDecision(str, enum.Enum):
    """Execution disposition outcome determined by policy rules."""

    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"


class Policy(Base):
    """Rule entity that enforces security controls on tool invocations."""

    __tablename__ = "policies"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name = Column(String(128), index=True, nullable=False)
    description = Column(Text, nullable=True)
    tool_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("tools.id", ondelete="SET NULL"),
        nullable=True,
    )
    tool_name_pattern = Column(String(128), nullable=False, default="*")
    operation = Column(String(64), nullable=True)
    risk_level = Column(
        SQLEnum(RiskLevel, name="risk_level_enum", native_enum=False),
        nullable=True,
    )
    decision = Column(
        SQLEnum(PolicyDecision, name="policy_decision_enum", native_enum=False),
        nullable=False,
        default=PolicyDecision.DENY,
    )
    conditions = Column(JSON, default=dict, nullable=False)
    priority = Column(Integer, default=100, nullable=False, index=True)
    is_enabled = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    tool = relationship("Tool", foreign_keys=[tool_id])
