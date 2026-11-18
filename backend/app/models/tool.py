"""Tool Definition and Metadata Models."""

import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    JSON,
    String,
    Text,
    Uuid,
)
from app.database import Base


class RiskLevel(str, enum.Enum):
    """Categorized risk rating for tools and operations."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Tool(Base):
    """Catalog of execution tools available via the MCP gateway."""

    __tablename__ = "tools"

    id = Column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name = Column(String(128), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    risk_level = Column(
        SQLEnum(RiskLevel, name="risk_level_enum", native_enum=False),
        nullable=False,
        default=RiskLevel.LOW,
    )
    handler_key = Column(String(128), unique=True, nullable=False)
    schema_definition = Column(JSON, default=dict, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    requires_approval = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
