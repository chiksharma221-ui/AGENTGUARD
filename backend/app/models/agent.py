"""AI Agent and Agent Credential Models."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Agent(Base):
    """Registered AI Agent identity governed by AgentGuard."""

    __tablename__ = "agents"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name = Column(String(128), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    # Using 'meta' attribute mapped to 'metadata' column in DB to prevent conflicts with Base.metadata
    meta = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
    last_seen_at = Column(DateTime, nullable=True)

    credentials = relationship(
        "AgentCredential",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class AgentCredential(Base):
    """API key credential used by an AI Agent for gateway authentication."""

    __tablename__ = "agent_credentials"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    agent_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    api_key_hash = Column(String(64), unique=True, index=True, nullable=False)
    key_prefix = Column(String(8), nullable=False)
    label = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    agent = relationship("Agent", back_populates="credentials")
