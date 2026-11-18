"""Cryptographic Hash-Chained Audit Logging Service."""

import csv
import hashlib
import io
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.audit import AuditLog, ExecutionStatus
from app.models.approval import DecisionType
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel
from app.schemas.audit import AuditLogFilter


class AuditService:
    """Service managing append-only, tamper-evident audit logs."""

    GENESIS_HASH = "0" * 64

    @classmethod
    def _compute_row_hash(
        cls,
        prev_hash: str,
        request_id: UUID | None,
        agent_id: UUID | None,
        user_id: UUID | None,
        tool_name: str,
        arguments_ref: str | None,
        policy_decision: str,
        risk_level: str,
        approval_decision: str | None,
        execution_status: str | None,
        approver_id: UUID | None,
        ip_address: str | None,
        created_at_iso: str,
    ) -> str:
        """Compute SHA-256 hash connecting this row to the previous hash."""
        payload = (
            f"{prev_hash}|"
            f"{str(request_id) if request_id else ''}|"
            f"{str(agent_id) if agent_id else ''}|"
            f"{str(user_id) if user_id else ''}|"
            f"{tool_name}|"
            f"{arguments_ref or ''}|"
            f"{policy_decision}|"
            f"{risk_level}|"
            f"{approval_decision or ''}|"
            f"{execution_status or ''}|"
            f"{str(approver_id) if approver_id else ''}|"
            f"{ip_address or ''}|"
            f"{created_at_iso}"
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def log_request(
        cls,
        db: Session,
        tool_name: str,
        policy_decision: PolicyDecision,
        risk_level: RiskLevel,
        request_id: UUID | None = None,
        agent_id: UUID | None = None,
        user_id: UUID | None = None,
        arguments_ref: str | None = None,
        approval_decision: DecisionType | None = None,
        execution_status: ExecutionStatus | None = None,
        approver_id: UUID | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        """Append a new verified record to the cryptographic audit chain."""
        # Get the previous row's hash
        last_log = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .first()
        )
        prev_hash = last_log.row_hash if last_log else cls.GENESIS_HASH

        now = datetime.utcnow()
        now_iso = now.isoformat()

        row_hash = cls._compute_row_hash(
            prev_hash=prev_hash,
            request_id=request_id,
            agent_id=agent_id,
            user_id=user_id,
            tool_name=tool_name,
            arguments_ref=arguments_ref,
            policy_decision=policy_decision.value if hasattr(policy_decision, "value") else str(policy_decision),
            risk_level=risk_level.value if hasattr(risk_level, "value") else str(risk_level),
            approval_decision=approval_decision.value if approval_decision and hasattr(approval_decision, "value") else str(approval_decision) if approval_decision else None,
            execution_status=execution_status.value if execution_status and hasattr(execution_status, "value") else str(execution_status) if execution_status else None,
            approver_id=approver_id,
            ip_address=ip_address,
            created_at_iso=now_iso,
        )

        audit_entry = AuditLog(
            request_id=request_id,
            agent_id=agent_id,
            user_id=user_id,
            tool_name=tool_name,
            arguments_ref=arguments_ref,
            policy_decision=policy_decision,
            risk_level=risk_level,
            approval_decision=approval_decision,
            execution_status=execution_status,
            approver_id=approver_id,
            ip_address=ip_address,
            prev_hash=prev_hash,
            row_hash=row_hash,
            created_at=now,
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry

    @classmethod
    def get_audit_logs(
        cls,
        db: Session,
        filters: AuditLogFilter,
    ) -> tuple[list[AuditLog], int]:
        """Query audit log entries matching provided filters with pagination."""
        query = db.query(AuditLog)

        if filters.user_id:
            query = query.filter(AuditLog.user_id == filters.user_id)
        if filters.agent_id:
            query = query.filter(AuditLog.agent_id == filters.agent_id)
        if filters.tool_name:
            query = query.filter(AuditLog.tool_name.ilike(f"%{filters.tool_name}%"))
        if filters.policy_decision:
            query = query.filter(AuditLog.policy_decision == filters.policy_decision)
        if filters.risk_level:
            query = query.filter(AuditLog.risk_level == filters.risk_level)
        if filters.status:
            query = query.filter(AuditLog.execution_status == filters.status)
        if filters.from_time:
            query = query.filter(AuditLog.created_at >= filters.from_time)
        if filters.to_time:
            query = query.filter(AuditLog.created_at <= filters.to_time)

        total = query.count()
        logs = (
            query.order_by(AuditLog.created_at.desc())
            .offset(filters.skip)
            .limit(filters.limit)
            .all()
        )
        return logs, total

    @classmethod
    def verify_audit_chain(cls, db: Session) -> bool:
        """Traverse the entire audit trail and verify cryptographic hash integrity."""
        logs = db.query(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc()).all()
        if not logs:
            return True

        expected_prev_hash = cls.GENESIS_HASH
        for log in logs:
            if log.prev_hash != expected_prev_hash:
                return False

            recalculated = cls._compute_row_hash(
                prev_hash=log.prev_hash,
                request_id=log.request_id,
                agent_id=log.agent_id,
                user_id=log.user_id,
                tool_name=log.tool_name,
                arguments_ref=log.arguments_ref,
                policy_decision=log.policy_decision.value if hasattr(log.policy_decision, "value") else str(log.policy_decision),
                risk_level=log.risk_level.value if hasattr(log.risk_level, "value") else str(log.risk_level),
                approval_decision=log.approval_decision.value if log.approval_decision and hasattr(log.approval_decision, "value") else str(log.approval_decision) if log.approval_decision else None,
                execution_status=log.execution_status.value if log.execution_status and hasattr(log.execution_status, "value") else str(log.execution_status) if log.execution_status else None,
                approver_id=log.approver_id,
                ip_address=log.ip_address,
                created_at_iso=log.created_at.isoformat(),
            )
            if recalculated != log.row_hash:
                return False

            expected_prev_hash = log.row_hash

        return True

    @classmethod
    def export_csv(cls, db: Session, filters: AuditLogFilter) -> str:
        """Export filtered audit logs as a downloadable CSV string."""
        logs, _ = cls.get_audit_logs(db, filters)
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "ID",
            "Timestamp",
            "Tool Name",
            "Policy Decision",
            "Risk Level",
            "Approval Decision",
            "Execution Status",
            "Agent ID",
            "User ID",
            "Approver ID",
            "IP Address",
            "Row Hash",
            "Prev Hash",
        ])

        for entry in logs:
            writer.writerow([
                str(entry.id),
                entry.created_at.isoformat(),
                entry.tool_name,
                entry.policy_decision.value if hasattr(entry.policy_decision, "value") else str(entry.policy_decision),
                entry.risk_level.value if hasattr(entry.risk_level, "value") else str(entry.risk_level),
                entry.approval_decision.value if entry.approval_decision and hasattr(entry.approval_decision, "value") else str(entry.approval_decision) if entry.approval_decision else "",
                entry.execution_status.value if entry.execution_status and hasattr(entry.execution_status, "value") else str(entry.execution_status) if entry.execution_status else "",
                str(entry.agent_id) if entry.agent_id else "",
                str(entry.user_id) if entry.user_id else "",
                str(entry.approver_id) if entry.approver_id else "",
                entry.ip_address or "",
                entry.row_hash,
                entry.prev_hash,
            ])

        return output.getvalue()
