"""Audit Trail and Compliance API Router."""

from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_audit_reader
from app.models.approval import DecisionType
from app.models.audit import AuditLog, ExecutionRecord, ExecutionStatus
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel
from app.models.user import User
from app.schemas.audit import (
    AuditLogFilter,
    AuditLogResponse,
    AuditStatsResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit & Compliance"])


def _audit_user_scope(current_user: User) -> UUID | None:
    global_audit_roles = {"Administrator", "SecurityOfficer", "Approver"}
    if current_user.is_superuser or any(
        role.name in global_audit_roles for role in current_user.roles
    ):
        return None
    return current_user.id


@router.get("", response_model=list[AuditLogResponse])
def get_audit_trail(
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    agent_id: UUID | None = Query(None),
    tool: str | None = Query(None),
    status: ExecutionStatus | None = Query(None),
    risk_level: RiskLevel | None = Query(None),
    policy_decision: PolicyDecision | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_audit_reader),
) -> list[AuditLog]:
    """Retrieve cryptographically verified audit records matching filter criteria."""
    filters = AuditLogFilter(
        user_id=_audit_user_scope(current_user),
        from_time=from_time,
        to_time=to_time,
        agent_id=agent_id,
        tool_name=tool,
        status=status,
        risk_level=risk_level,
        policy_decision=policy_decision,
        skip=skip,
        limit=limit,
    )
    logs, _ = AuditService.get_audit_logs(db, filters)
    return logs


@router.get("/export")
def export_audit_csv(
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    agent_id: UUID | None = Query(None),
    tool: str | None = Query(None),
    status: ExecutionStatus | None = Query(None),
    risk_level: RiskLevel | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_audit_reader),
) -> Response:
    """Generate and download audit logs in CSV format for compliance reporting."""
    filters = AuditLogFilter(
        user_id=_audit_user_scope(current_user),
        from_time=from_time,
        to_time=to_time,
        agent_id=agent_id,
        tool_name=tool,
        status=status,
        risk_level=risk_level,
        limit=1000,
        skip=0,
    )
    csv_data = AuditService.export_csv(db, filters)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=agentguard_audit_trail.csv"},
    )


@router.get("/stats", response_model=AuditStatsResponse)
def get_audit_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_audit_reader),
) -> AuditStatsResponse:
    """Aggregate high-level execution statistics and verify chain integrity."""
    user_scope = _audit_user_scope(current_user)
    audit_query = db.query(AuditLog)
    if user_scope:
        audit_query = audit_query.filter(AuditLog.user_id == user_scope)

    total_invocations = audit_query.count()
    total_allowed = audit_query.filter(AuditLog.policy_decision == PolicyDecision.ALLOW).count()
    total_denied = audit_query.filter(AuditLog.policy_decision == PolicyDecision.DENY).count()
    total_pending = audit_query.filter(AuditLog.policy_decision == PolicyDecision.REQUIRE_APPROVAL).count()

    execution_query = db.query(ExecutionRecord)
    if user_scope:
        execution_query = (
            execution_query.join(AuditLog, ExecutionRecord.request_id == AuditLog.request_id)
            .filter(AuditLog.user_id == user_scope)
            .distinct()
        )
    total_executed = execution_query.filter(ExecutionRecord.status == ExecutionStatus.SUCCESS).count()

    # Risk breakdown
    risk_query = db.query(AuditLog.risk_level, func.count(AuditLog.id))
    if user_scope:
        risk_query = risk_query.filter(AuditLog.user_id == user_scope)
    risk_counts = risk_query.group_by(AuditLog.risk_level).all()
    breakdown = {str(k.value if hasattr(k, "value") else k): count for k, count in risk_counts}

    # Verify cryptographic hash chain
    chain_verified = AuditService.verify_audit_chain(db)

    return AuditStatsResponse(
        total_invocations=total_invocations,
        total_allowed=total_allowed,
        total_denied=total_denied,
        total_pending_approval=total_pending,
        total_executed=total_executed,
        chain_verified=chain_verified,
        risk_breakdown=breakdown,
    )


@router.get("/{audit_id}", response_model=AuditLogResponse)
def get_audit_log_entry(
    audit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_audit_reader),
) -> AuditLog:
    """Fetch individual audit entry including cryptographic row hash."""
    query = db.query(AuditLog).filter(AuditLog.id == audit_id)
    user_scope = _audit_user_scope(current_user)
    if user_scope:
        query = query.filter(AuditLog.user_id == user_scope)
    entry = query.first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log entry not found.")
    return entry
