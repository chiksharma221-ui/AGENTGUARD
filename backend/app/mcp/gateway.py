"""Model Context Protocol (MCP) Secure Gateway Core."""

import json
from typing import Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import (
    AgentDisabledError,
    PolicyDeniedError,
    ToolDisabledError,
    ToolNotFoundError,
)
from app.models.agent import Agent
from app.models.audit import ExecutionStatus
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel, Tool
from app.models.user import User
from app.mcp.tool_registry import tool_registry
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService
from app.services.execution_engine import ExecutionEngine
from app.services.policy_engine import EvaluationContext, PolicyEngine, policy_engine


class MCPGateway:
    """Security governance gateway enforcing policy evaluation, approval barriers, and execution dispatch."""

    def __init__(
        self,
        engine_policy: PolicyEngine = policy_engine,
        service_approval: type[ApprovalService] = ApprovalService,
        engine_exec: type[ExecutionEngine] = ExecutionEngine,
        service_audit: type[AuditService] = AuditService,
    ) -> None:
        self.policy_engine = engine_policy
        self.approval_service = service_approval
        self.execution_engine = engine_exec
        self.audit_service = service_audit

    async def invoke_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any],
        agent: Agent,
        db: Session,
        user: User | None = None,
        approval_request_id: str | UUID | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Process an inbound tool invocation through governance filters.
        
        Lifecycle:
        1. Ensure agent is active.
        2. Ensure tool is registered and enabled.
        3. If approval_request_id is provided, verify dual custody and execute.
        4. Otherwise, evaluate policy:
           - ALLOW: execute directly
           - DENY: reject invocation and log denial
           - REQUIRE_APPROVAL: persist approval request and return 202-style pending payload
        """
        # 1. Agent validity
        if not agent.is_active:
            raise AgentDisabledError("Agent is inactive or disabled.")

        # 2. Tool validity
        tool_def = tool_registry.get(tool_name)
        if not tool_def:
            raise ToolNotFoundError(f"Tool '{tool_name}' not found in registry.")

        db_tool = db.query(Tool).filter(Tool.name == tool_name).first()
        if db_tool and not db_tool.is_enabled:
            raise ToolDisabledError(f"Tool '{tool_name}' is currently disabled.")

        risk_level = db_tool.risk_level if db_tool else tool_def.risk_level
        risk_str = risk_level.value if hasattr(risk_level, "value") else str(risk_level)

        # 3. Post-approval invocation branch
        if approval_request_id:
            req_uuid = UUID(str(approval_request_id))
            approval_req = self.approval_service.verify_approval_still_valid(
                db=db,
                request_id=req_uuid,
                arguments=arguments,
            )

            exec_res = await self.execution_engine.execute_tool(
                db=db,
                tool_name=tool_name,
                arguments=arguments,
                agent=agent,
                approval_request=approval_req,
                ip_address=ip_address,
            )

            return {
                "status": "SUCCESS" if exec_res.get("success") else "FAILED",
                "tool_name": tool_name,
                "approval_request_id": str(approval_req.id),
                "result": exec_res.get("result"),
                "error": exec_res.get("error"),
                "execution_duration_ms": exec_res.get("duration_ms", 0),
            }

        # 4. Fresh invocation: Policy Evaluation
        eval_ctx = EvaluationContext(
            tool_name=tool_name,
            operation=arguments.get("operation", ""),
            arguments=arguments,
            agent=agent,
            user=user,
            risk_level=risk_str,
        )
        eval_result = self.policy_engine.evaluate(eval_ctx, db)

        args_ref = json.dumps(arguments, default=str)[:500]

        # Case A: Policy Denied (Fail-Closed)
        if eval_result.decision == PolicyDecision.DENY:
            self.audit_service.log_request(
                db=db,
                tool_name=tool_name,
                policy_decision=PolicyDecision.DENY,
                risk_level=risk_level,
                agent_id=agent.id,
                user_id=user.id if user else None,
                arguments_ref=args_ref,
                execution_status=ExecutionStatus.DENIED,
                ip_address=ip_address,
            )
            return {
                "status": "DENIED",
                "tool_name": tool_name,
                "reason": eval_result.reason,
                "error": f"Execution denied by policy: {eval_result.reason}",
                "result": None,
                "execution_duration_ms": 0,
            }

        # Case B: Human Approval Required
        if eval_result.decision == PolicyDecision.REQUIRE_APPROVAL:
            approval_req = self.approval_service.create_approval_request(
                db=db,
                tool_name=tool_name,
                arguments=arguments,
                agent=agent,
                risk_level=risk_level,
                reason=eval_result.reason,
                requested_by_user_id=user.id if user else None,
            )
            return {
                "status": "PENDING_APPROVAL",
                "tool_name": tool_name,
                "approval_request_id": str(approval_req.id),
                "reason": eval_result.reason,
                "message": "Tool execution paused pending administrative approval.",
                "result": None,
                "execution_duration_ms": 0,
            }

        # Case C: Policy Allowed
        exec_res = await self.execution_engine.execute_tool(
            db=db,
            tool_name=tool_name,
            arguments=arguments,
            agent=agent,
            approval_request=None,
            ip_address=ip_address,
        )

        return {
            "status": "SUCCESS" if exec_res.get("success") else "FAILED",
            "tool_name": tool_name,
            "result": exec_res.get("result"),
            "error": exec_res.get("error"),
            "execution_duration_ms": exec_res.get("duration_ms", 0),
        }


# Singleton gateway instance
mcp_gateway = MCPGateway()
