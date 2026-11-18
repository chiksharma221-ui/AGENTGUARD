"""Centralized MCP Tool Registry with In-Memory Catalog and Database Synchronization."""

from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine
from sqlalchemy.orm import Session
from app.models.tool import RiskLevel, Tool
from app.mcp.handlers import filesystem as fs
from app.mcp.handlers import github as gh
from app.mcp.handlers import database as db_handlers


@dataclass
class ToolDefinition:
    """Descriptor specifying metadata, risk classification, JSON schema, and execution handler."""

    name: str
    description: str
    risk_level: RiskLevel
    handler_key: str
    schema: dict[str, Any]
    requires_approval: bool
    permissions: list[str] = field(default_factory=list)
    handler: Callable[[dict[str, Any]], Coroutine[Any, Any, dict[str, Any]]] = None  # type: ignore


class ToolRegistry:
    """Catalog managing all registered MCP executable capabilities."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool_def: ToolDefinition) -> None:
        """Register a tool definition into memory."""
        self._tools[tool_def.name] = tool_def

    def get(self, name: str) -> ToolDefinition | None:
        """Look up tool by exact canonical name."""
        return self._tools.get(name)

    def list_all(self) -> list[ToolDefinition]:
        """Return all registered tool definitions."""
        return list(self._tools.values())

    def get_risk_level(self, name: str) -> str:
        """Return registered risk rating string or default HIGH."""
        tool = self.get(name)
        if tool:
            return tool.risk_level.value
        return RiskLevel.HIGH.value

    def sync_to_db(self, db: Session) -> None:
        """Synchronize in-memory tool catalog with the database Tool table."""
        for tool_def in self._tools.values():
            existing = db.query(Tool).filter(Tool.name == tool_def.name).first()
            if existing:
                existing.description = tool_def.description
                existing.risk_level = tool_def.risk_level
                existing.handler_key = tool_def.handler_key
                existing.schema_definition = tool_def.schema
                existing.requires_approval = tool_def.requires_approval
            else:
                db_tool = Tool(
                    name=tool_def.name,
                    description=tool_def.description,
                    risk_level=tool_def.risk_level,
                    handler_key=tool_def.handler_key,
                    schema_definition=tool_def.schema,
                    is_enabled=True,
                    requires_approval=tool_def.requires_approval,
                )
                db.add(db_tool)
        db.commit()


# Instantiate global registry
tool_registry = ToolRegistry()

# -------------------------------------------------------------
# Filesystem Tools
# -------------------------------------------------------------
tool_registry.register(
    ToolDefinition(
        name="filesystem.list_files",
        description="List files and subdirectories located within the designated sandbox root.",
        risk_level=RiskLevel.LOW,
        handler_key="filesystem.list_files",
        requires_approval=False,
        permissions=["fs:read"],
        handler=fs.handle_list_files,
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative directory path inside sandbox", "default": ""},
            },
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="filesystem.read_file",
        description="Read UTF-8 content from a file located within the sandbox.",
        risk_level=RiskLevel.LOW,
        handler_key="filesystem.read_file",
        requires_approval=False,
        permissions=["fs:read"],
        handler=fs.handle_read_file,
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative file path inside sandbox"},
                "max_bytes": {"type": "integer", "description": "Maximum bytes to read", "default": 1048576},
            },
            "required": ["path"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="filesystem.create_file",
        description="Create a new file within the sandbox containing specified content.",
        risk_level=RiskLevel.MEDIUM,
        handler_key="filesystem.create_file",
        requires_approval=True,
        permissions=["fs:write"],
        handler=fs.handle_create_file,
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative file path inside sandbox"},
                "content": {"type": "string", "description": "Text content to write"},
                "overwrite": {"type": "boolean", "description": "Overwrite existing file", "default": False},
            },
            "required": ["path", "content"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="filesystem.update_file",
        description="Update or append content to an existing file within the sandbox.",
        risk_level=RiskLevel.MEDIUM,
        handler_key="filesystem.update_file",
        requires_approval=True,
        permissions=["fs:write"],
        handler=fs.handle_update_file,
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative file path inside sandbox"},
                "content": {"type": "string", "description": "Content to write or append"},
                "append": {"type": "boolean", "description": "Append to file instead of overwrite", "default": False},
            },
            "required": ["path", "content"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="filesystem.delete_file",
        description="Delete a file or folder within the sandbox.",
        risk_level=RiskLevel.HIGH,
        handler_key="filesystem.delete_file",
        requires_approval=True,
        permissions=["fs:delete"],
        handler=fs.handle_delete_file,
        schema={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Relative path to file or directory to delete"},
            },
            "required": ["path"],
        },
    )
)

# -------------------------------------------------------------
# GitHub Tools
# -------------------------------------------------------------
tool_registry.register(
    ToolDefinition(
        name="github.list_repos",
        description="List repositories available to the authenticated account.",
        risk_level=RiskLevel.LOW,
        handler_key="github.list_repos",
        requires_approval=False,
        permissions=["gh:read"],
        handler=gh.handle_list_repos,
        schema={
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Max repositories to return", "default": 10},
            },
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="github.get_repo",
        description="Get metadata for a specific GitHub repository.",
        risk_level=RiskLevel.LOW,
        handler_key="github.get_repo",
        requires_approval=False,
        permissions=["gh:read"],
        handler=gh.handle_get_repo,
        schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Full repo name (e.g. owner/repo)"},
            },
            "required": ["repo"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="github.create_issue",
        description="Create a new issue in a GitHub repository.",
        risk_level=RiskLevel.MEDIUM,
        handler_key="github.create_issue",
        requires_approval=True,
        permissions=["gh:write"],
        handler=gh.handle_create_issue,
        schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Full repo name (e.g. owner/repo)"},
                "title": {"type": "string", "description": "Issue title"},
                "body": {"type": "string", "description": "Issue description content", "default": ""},
            },
            "required": ["repo", "title"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="github.create_branch",
        description="Create a new git branch from an existing source branch in a repository.",
        risk_level=RiskLevel.MEDIUM,
        handler_key="github.create_branch",
        requires_approval=True,
        permissions=["gh:write"],
        handler=gh.handle_create_branch,
        schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Full repo name (e.g. owner/repo)"},
                "branch": {"type": "string", "description": "Name of branch to create"},
                "source_branch": {"type": "string", "description": "Source branch name", "default": "main"},
            },
            "required": ["repo", "branch"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="github.update_file",
        description="Commit changes to a file in a GitHub repository.",
        risk_level=RiskLevel.HIGH,
        handler_key="github.update_file",
        requires_approval=True,
        permissions=["gh:write"],
        handler=gh.handle_update_file,
        schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Full repo name (e.g. owner/repo)"},
                "path": {"type": "string", "description": "File path in repository"},
                "content": {"type": "string", "description": "File content"},
                "message": {"type": "string", "description": "Commit message", "default": "Commit via AgentGuard"},
                "branch": {"type": "string", "description": "Target branch", "default": "main"},
            },
            "required": ["repo", "path", "content"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="github.delete_file",
        description="Delete a file from a GitHub repository.",
        risk_level=RiskLevel.HIGH,
        handler_key="github.delete_file",
        requires_approval=True,
        permissions=["gh:delete"],
        handler=gh.handle_delete_file,
        schema={
            "type": "object",
            "properties": {
                "repo": {"type": "string", "description": "Full repo name (e.g. owner/repo)"},
                "path": {"type": "string", "description": "File path in repository"},
                "message": {"type": "string", "description": "Commit message", "default": "Delete file via AgentGuard"},
                "branch": {"type": "string", "description": "Target branch", "default": "main"},
            },
            "required": ["repo", "path"],
        },
    )
)

# -------------------------------------------------------------
# Database Tools
# -------------------------------------------------------------
tool_registry.register(
    ToolDefinition(
        name="database.execute_select",
        description="Execute a read-only SELECT query against the database with strict injection protection.",
        risk_level=RiskLevel.LOW,
        handler_key="database.execute_select",
        requires_approval=False,
        permissions=["db:read"],
        handler=db_handlers.handle_execute_select,
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "SELECT SQL query"},
                "params": {"type": "object", "description": "Bound query parameters", "default": {}},
            },
            "required": ["query"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="database.insert_record",
        description="Insert a new row into an allowed table using parameterized columns.",
        risk_level=RiskLevel.MEDIUM,
        handler_key="database.insert_record",
        requires_approval=True,
        permissions=["db:write"],
        handler=db_handlers.handle_insert_record,
        schema={
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Target table name"},
                "data": {"type": "object", "description": "Column-value dictionary to insert"},
            },
            "required": ["table", "data"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="database.update_record",
        description="Update existing records in a table matching specific conditions.",
        risk_level=RiskLevel.HIGH,
        handler_key="database.update_record",
        requires_approval=True,
        permissions=["db:write"],
        handler=db_handlers.handle_update_record,
        schema={
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Target table name"},
                "data": {"type": "object", "description": "Column-value update mappings"},
                "where": {"type": "string", "description": "Parameterized WHERE clause (e.g. 'id = :target_id')"},
                "params": {"type": "object", "description": "WHERE clause bound parameters", "default": {}},
            },
            "required": ["table", "data", "where"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="database.delete_record",
        description="Delete records from a database table matching specific conditions.",
        risk_level=RiskLevel.CRITICAL,
        handler_key="database.delete_record",
        requires_approval=True,
        permissions=["db:delete"],
        handler=db_handlers.handle_delete_record,
        schema={
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Target table name"},
                "where": {"type": "string", "description": "Parameterized WHERE clause (e.g. 'id = :target_id')"},
                "params": {"type": "object", "description": "WHERE clause bound parameters", "default": {}},
            },
            "required": ["table", "where"],
        },
    )
)

tool_registry.register(
    ToolDefinition(
        name="database.inspect_schema",
        description="Inspect table schemas, columns, types, and primary key constraints.",
        risk_level=RiskLevel.LOW,
        handler_key="database.inspect_schema",
        requires_approval=False,
        permissions=["db:read"],
        handler=db_handlers.handle_inspect_schema,
        schema={
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Optional specific table to inspect"},
            },
        },
    )
)
