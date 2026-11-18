"""Secure Tool Execution Engine with Audit Logging and State Transitioning."""

import asyncio
import inspect
import json
import time
from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from app.core.exceptions import ToolDisabledError, ToolNotFoundError
from app.models.agent import Agent
from app.models.approval import ApprovalRequest, ApprovalStatus
from app.models.audit import ExecutionRecord, ExecutionStatus
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel, Tool
from app.mcp.tool_registry import tool_registry
from app.services.approval_service import ApprovalService
from app.services.audit_service import AuditService


class ExecutionEngine:
    """Dispatches tool execution with timing telemetry, audit chaining, and exception safety."""

    @staticmethod
    async def execute_tool(
        db: Session,
        tool_name: str,
        arguments: dict[str, Any],
        agent: Agent,
        approval_request: ApprovalRequest | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Execute tool, enforce approval validity if present, log execution record and audit trail."""
        # 1. If executing under an approval, re-verify validity and argument integrity
        if approval_request:
            ApprovalService.verify_approval_still_valid(db, approval_request.id, arguments)
            approval_request.status = ApprovalStatus.EXECUTING
            approval_request.updated_at = datetime.utcnow()
            db.commit()

        # 2. Look up in-memory registry and database catalog
        tool_def = tool_registry.get(tool_name)
        if not tool_def or not tool_def.handler:
            raise ToolNotFoundError(f"Tool '{tool_name}' is not registered in execution engine.")

        db_tool = db.query(Tool).filter(Tool.name == tool_name).first()
        if db_tool and not db_tool.is_enabled:
            raise ToolDisabledError(f"Tool '{tool_name}' is currently disabled by administrator.")

        tool_id = db_tool.id if db_tool else None
        risk = db_tool.risk_level if db_tool else tool_def.risk_level

        # 3. Create initial ExecutionRecord
        args_ref = json.dumps(arguments, default=str)[:500]
        start_time = time.perf_counter()
        started_at = datetime.utcnow()

        record = ExecutionRecord(
            request_id=approval_request.id if approval_request else None,
            agent_id=agent.id,
            tool_id=tool_id,
            tool_name=tool_name,
            arguments_ref=args_ref,
            status=ExecutionStatus.PENDING_APPROVAL if approval_request and approval_request.status == ApprovalStatus.PENDING else ExecutionStatus.SUCCESS,
            started_at=started_at,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        # 4. Invoke the handler
        try:
            handler = tool_def.handler
            if inspect.iscoroutinefunction(handler):
                result = await handler(arguments)
            else:
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, handler, arguments)

            duration_ms = int((time.perf_counter() - start_time) * 1000)
            completed_at = datetime.utcnow()

            # 5. Update execution record on success
            record.status = ExecutionStatus.SUCCESS
            record.result_summary = json.dumps(result, default=str)[:1000]
            record.completed_at = completed_at
            record.duration_ms = duration_ms

            if approval_request:
                approval_request.status = ApprovalStatus.EXECUTED
                approval_request.updated_at = completed_at

            db.commit()

            # 6. Append to audit log
            AuditService.log_request(
                db=db,
                tool_name=tool_name,
                policy_decision=PolicyDecision.ALLOW,
                risk_level=risk,
                request_id=approval_request.id if approval_request else None,
                agent_id=agent.id,
                arguments_ref=args_ref,
                execution_status=ExecutionStatus.SUCCESS,
                ip_address=ip_address,
            )

            return {
                "success": True,
                "tool_name": tool_name,
                "execution_record_id": str(record.id),
                "duration_ms": duration_ms,
                "result": result,
            }

        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            completed_at = datetime.utcnow()
            error_message = str(exc)

            record.status = ExecutionStatus.FAILED
            record.error_detail = error_message
            record.completed_at = completed_at
            record.duration_ms = duration_ms

            if approval_request:
                approval_request.status = ApprovalStatus.FAILED
                approval_request.updated_at = completed_at

            db.commit()

            AuditService.log_request(
                db=db,
                tool_name=tool_name,
                policy_decision=PolicyDecision.ALLOW,
                risk_level=risk,
                request_id=approval_request.id if approval_request else None,
                agent_id=agent.id,
                arguments_ref=args_ref,
                execution_status=ExecutionStatus.FAILED,
                ip_address=ip_address,
            )

            return {
                "success": False,
                "tool_name": tool_name,
                "execution_record_id": str(record.id),
                "duration_ms": duration_ms,
                "error": error_message,
            }


# Singleton execution engine
execution_engine = ExecutionEngine()
