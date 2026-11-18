"""Tool Catalog and MCP Invocation API Router."""

from typing import Any
from uuid import UUID
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import (
    get_agent_from_api_key,
    get_current_active_user,
    get_current_admin,
    get_optional_current_user,
)
from app.models.agent import Agent
from app.models.approval import ApprovalRequest, ApprovalStatus
from app.models.audit import ExecutionRecord, ExecutionStatus
from app.models.tool import Tool
from app.models.user import User
from app.mcp.gateway import mcp_gateway
from app.mcp.tool_registry import tool_registry
from app.schemas.tool import (
    ToolInvokeRequest,
    ToolInvokeResponse,
    ToolResponse,
    ToolUpdate,
)

router = APIRouter(tags=["Tools & MCP Gateway"])


@router.get("/tools", response_model=list[ToolResponse])
def list_tools(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user),
) -> list[Tool]:
    """List all registered tools in the database catalog."""
    return db.query(Tool).order_by(Tool.name.asc()).all()


@router.get("/tools/{tool_id}", response_model=ToolResponse)
def get_tool(
    tool_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_active_user),
) -> Tool:
    """Retrieve details and schema for a specific tool."""
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found.")
    return tool


@router.put("/tools/{tool_id}/toggle", response_model=ToolResponse)
def toggle_tool(
    tool_id: UUID,
    is_enabled: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Tool:
    """Enable or disable a tool in the gateway catalog (Administrator only)."""
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found.")

    tool.is_enabled = is_enabled
    db.commit()
    db.refresh(tool)
    return tool


# ---------------------------------------------------------------------------
# MCP Gateway Invocation Endpoints
# ---------------------------------------------------------------------------

@router.get("/mcp/tools")
def get_mcp_tools() -> dict[str, Any]:
    """Public discovery endpoint returning all tools registered in the MCP gateway."""
    tools = tool_registry.list_all()
    return {
        "total": len(tools),
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "risk_level": t.risk_level.value,
                "requires_approval": t.requires_approval,
                "schema": t.schema,
            }
            for t in tools
        ],
    }


@router.get("/mcp/status")
def get_mcp_status() -> dict[str, Any]:
    """Check gateway operational status and active tool counts."""
    return {
        "status": "OPERATIONAL",
        "protocol_version": "2024-11-05",
        "registered_tools_count": len(tool_registry.list_all()),
        "gateway": "AgentGuard Security & Governance Gateway",
    }


@router.post("/mcp/invoke", response_model=ToolInvokeResponse)
async def invoke_mcp_tool(
    payload: ToolInvokeRequest,
    request: Request,
    agent: Agent = Depends(get_agent_from_api_key),
    optional_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> ToolInvokeResponse:
    """Execute a tool through the MCP governance pipeline (Authenticated via Agent API Key)."""
    client_ip = request.client.host if request.client else None

    res = await mcp_gateway.invoke_tool(
        tool_name=payload.tool_name,
        arguments=payload.arguments,
        agent=agent,
        db=db,
        user=optional_user,
        approval_request_id=payload.approval_request_id,
        ip_address=client_ip,
    )

    return ToolInvokeResponse(
        status=res.get("status", "FAILED"),
        tool_name=payload.tool_name,
        approval_request_id=res.get("approval_request_id"),
        result=res.get("result"),
        error=res.get("error"),
        reason=res.get("reason"),
        execution_duration_ms=res.get("execution_duration_ms", 0),
    )


@router.post("/mcp/result/{request_id}", response_model=ToolInvokeResponse)
async def poll_approval_result(
    request_id: UUID,
    request: Request,
    agent: Agent = Depends(get_agent_from_api_key),
    db: Session = Depends(get_db),
) -> ToolInvokeResponse:
    """Check status of an approval request and trigger execution once approved."""
    req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval request not found.",
        )

    # Agent cannot poll approval belonging to another agent
    if req.agent_id != agent.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: request belongs to another agent.",
        )

    if req.status == ApprovalStatus.PENDING:
        return ToolInvokeResponse(
            status="PENDING_APPROVAL",
            tool_name=req.tool_name,
            approval_request_id=req.id,
            reason="Request is still awaiting administrative review.",
        )

    if req.status == ApprovalStatus.REJECTED:
        return ToolInvokeResponse(
            status="DENIED",
            tool_name=req.tool_name,
            approval_request_id=req.id,
            reason="Approval request was rejected by an administrator.",
            error="Human approver rejected this operation.",
        )

    if req.status == ApprovalStatus.EXPIRED:
        return ToolInvokeResponse(
            status="DENIED",
            tool_name=req.tool_name,
            approval_request_id=req.id,
            reason="Approval request has expired.",
            error="Request exceeded maximum waiting time.",
        )

    if req.status == ApprovalStatus.EXECUTED:
        # Fetch the completed execution record
        exec_record = (
            db.query(ExecutionRecord)
            .filter(ExecutionRecord.request_id == req.id)
            .order_by(ExecutionRecord.created_at.desc())
            .first()
        )
        return ToolInvokeResponse(
            status="SUCCESS",
            tool_name=req.tool_name,
            approval_request_id=req.id,
            result=exec_record.result_summary if exec_record else None,
            execution_duration_ms=exec_record.duration_ms if exec_record else 0,
        )

    if req.status == ApprovalStatus.APPROVED:
        # Decrypt arguments and proceed with execution
        from app.core.security import decrypt_arguments
        args = decrypt_arguments(req.arguments_encrypted)
        client_ip = request.client.host if request.client else None

        res = await mcp_gateway.invoke_tool(
            tool_name=req.tool_name,
            arguments=args,
            agent=agent,
            db=db,
            approval_request_id=req.id,
            ip_address=client_ip,
        )
        return ToolInvokeResponse(
            status=res.get("status", "SUCCESS"),
            tool_name=req.tool_name,
            approval_request_id=req.id,
            result=res.get("result"),
            error=res.get("error"),
            execution_duration_ms=res.get("execution_duration_ms", 0),
        )

    return ToolInvokeResponse(
        status=req.status.value,
        tool_name=req.tool_name,
        approval_request_id=req.id,
        reason=f"Current status: {req.status.value}",
    )
