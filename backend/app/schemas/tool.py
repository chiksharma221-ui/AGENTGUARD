"""Tool Definition and Execution Pydantic V2 Schemas."""

import enum
from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.tool import RiskLevel


class HandlerKey(str, enum.Enum):
    # Filesystem handlers
    FS_LIST_FILES = "filesystem.list_files"
    FS_READ_FILE = "filesystem.read_file"
    FS_CREATE_FILE = "filesystem.create_file"
    FS_UPDATE_FILE = "filesystem.update_file"
    FS_DELETE_FILE = "filesystem.delete_file"

    # GitHub handlers
    GH_LIST_REPOS = "github.list_repos"
    GH_GET_REPO = "github.get_repo"
    GH_CREATE_ISSUE = "github.create_issue"
    GH_CREATE_BRANCH = "github.create_branch"
    GH_UPDATE_FILE = "github.update_file"
    GH_DELETE_FILE = "github.delete_file"

    # Database handlers
    DB_EXECUTE_SELECT = "database.execute_select"
    DB_INSERT_RECORD = "database.insert_record"
    DB_UPDATE_RECORD = "database.update_record"
    DB_DELETE_RECORD = "database.delete_record"
    DB_INSPECT_SCHEMA = "database.inspect_schema"


class ToolBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: str | None = None
    risk_level: RiskLevel = RiskLevel.LOW
    handler_key: str = Field(..., min_length=2, max_length=128)
    schema_definition: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True
    requires_approval: bool = False


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    description: str | None = None
    risk_level: RiskLevel | None = None
    is_enabled: bool | None = None
    requires_approval: bool | None = None
    schema_definition: dict[str, Any] | None = None


class ToolResponse(ToolBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ToolInvokeRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    approval_request_id: UUID | None = None


class ToolInvokeResponse(BaseModel):
    status: str  # SUCCESS, PENDING_APPROVAL, DENIED, FAILED
    tool_name: str
    request_id: UUID | None = None
    approval_request_id: UUID | None = None
    result: Any | None = None
    error: str | None = None
    reason: str | None = None
    execution_duration_ms: int = 0
