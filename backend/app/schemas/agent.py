"""AI Agent and Credential Pydantic V2 Schemas."""

import enum
from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class AgentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class AgentCredentialBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=128)
    expires_at: datetime | None = None


class AgentCredentialCreate(AgentCredentialBase):
    pass


class AgentCredentialResponse(AgentCredentialBase):
    id: UUID
    agent_id: UUID
    key_prefix: str
    is_revoked: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: str | None = None
    is_active: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    description: str | None = None
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    is_active: bool
    metadata: dict[str, Any] = Field(default_factory=dict, alias="meta")
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None
    credentials: list[AgentCredentialResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AgentCreatedWithKeyResponse(BaseModel):
    agent: AgentResponse
    api_key: str
    message: str = "Store this API key securely. It will never be shown again."


class AgentCredentialCreatedResponse(BaseModel):
    credential: AgentCredentialResponse
    api_key: str
    message: str = "Store this API key securely. It will never be shown again."


class AgentListResponse(BaseModel):
    total: int
    items: list[AgentResponse]
