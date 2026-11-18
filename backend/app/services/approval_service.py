"""Human-in-the-Loop Approval Lifecycle Service."""

import hashlib
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import (
    ApprovalAlreadyDecidedError,
    ApprovalExpiredError,
    ApprovalNotFoundError,
    AuthorizationError,
    IntegrityError,
)
from app.core.security import encrypt_arguments, hash_arguments
from app.models.agent import Agent
from app.models.approval import (
    ApprovalDecision,
    ApprovalRequest,
    ApprovalStatus,
    DecisionType,
)
from app.models.audit import ExecutionStatus
from app.models.policy import PolicyDecision
from app.models.tool import RiskLevel, Tool
from app.models.user import User
from app.services.audit_service import AuditService


class ApprovalService:
    """Service governing human authorization workflows and dual-custody verification."""

    @staticmethod
    def create_approval_request(
        db: Session,
        tool_name: str,
        arguments: dict[str, Any],
        agent: Agent,
        risk_level: RiskLevel,
        reason: str | None = None,
        requested_by_user_id: UUID | None = None,
        expires_minutes: int = 30,
    ) -> ApprovalRequest:
        """Create and persist an encrypted approval request pending operator review."""
        args_hash = hash_arguments(arguments)
        args_enc = encrypt_arguments(arguments)

        # Look up tool entity if registered
        tool = db.query(Tool).filter(Tool.name == tool_name).first()
        tool_id = tool.id if tool else None

        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=expires_minutes)

        seed = f"{agent.id}:{tool_name}:{args_hash}:{now.isoformat()}"
        request_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()

        req = ApprovalRequest(
            request_hash=request_hash,
            tool_id=tool_id,
            agent_id=agent.id,
            requested_by_user_id=requested_by_user_id,
            arguments_hash=args_hash,
            arguments_encrypted=args_enc,
            tool_name=tool_name,
            status=ApprovalStatus.PENDING,
            risk_level=risk_level,
            reason=reason or "Policy mandates human authorization prior to tool execution.",
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # Audit log the approval requirement
        AuditService.log_request(
            db=db,
            request_id=req.id,
            agent_id=agent.id,
            user_id=requested_by_user_id,
            tool_name=tool_name,
            arguments_ref=args_hash,
            policy_decision=PolicyDecision.REQUIRE_APPROVAL,
            risk_level=risk_level,
            execution_status=ExecutionStatus.PENDING_APPROVAL,
        )

        return req

    @staticmethod
    def get_approval_request(db: Session, request_id: UUID) -> ApprovalRequest:
        """Fetch approval request by ID or raise ApprovalNotFoundError."""
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not req:
            raise ApprovalNotFoundError(f"Approval request '{request_id}' not found.")
        return req

    @staticmethod
    def decide_approval(
        db: Session,
        request_id: UUID,
        approver: User,
        decision: DecisionType,
        comment: str | None = None,
    ) -> ApprovalDecision:
        """Record an explicit human decision on a pending request."""
        req = ApprovalService.get_approval_request(db, request_id)

        # 1. Validate approver role
        is_admin_or_approver = (
            approver.is_superuser
            or any(r.name in ("Administrator", "Approver") for r in approver.roles)
        )
        if not is_admin_or_approver:
            raise AuthorizationError("Only users with 'Approver' or 'Administrator' role may decide approvals.")

        # 2. Separation of duties: requester cannot approve their own request
        if req.requested_by_user_id and req.requested_by_user_id == approver.id and not approver.is_superuser:
            raise AuthorizationError("Separation of duties violation: requester cannot approve own request.")

        # 3. Check expiration
        now = datetime.utcnow()
        if req.expires_at < now:
            req.status = ApprovalStatus.EXPIRED
            req.updated_at = now
            db.commit()
            raise ApprovalExpiredError(f"Approval request '{request_id}' has expired.")

        # 4. Check already decided
        if req.status != ApprovalStatus.PENDING:
            raise ApprovalAlreadyDecidedError(f"Approval request has status '{req.status.value}'.")

        # 5. Apply decision
        now_decided = datetime.utcnow()
        req.status = ApprovalStatus.APPROVED if decision == DecisionType.APPROVED else ApprovalStatus.REJECTED
        req.updated_at = now_decided

        decision_record = ApprovalDecision(
            request_id=req.id,
            approver_id=approver.id,
            decision=decision,
            comment=comment,
            decided_at=now_decided,
        )
        db.add(decision_record)
        db.commit()
        db.refresh(decision_record)

        # Audit log the human decision
        AuditService.log_request(
            db=db,
            request_id=req.id,
            agent_id=req.agent_id,
            user_id=req.requested_by_user_id,
            tool_name=req.tool_name,
            arguments_ref=req.arguments_hash,
            policy_decision=PolicyDecision.REQUIRE_APPROVAL,
            risk_level=req.risk_level,
            approval_decision=decision,
            execution_status=ExecutionStatus.PENDING_APPROVAL if decision == DecisionType.APPROVED else ExecutionStatus.REJECTED,
            approver_id=approver.id,
        )

        return decision_record

    @staticmethod
    def list_pending_approvals(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ApprovalRequest], int]:
        """Fetch paginated pending requests that have not expired."""
        now = datetime.utcnow()
        query = (
            db.query(ApprovalRequest)
            .filter(
                ApprovalRequest.status == ApprovalStatus.PENDING,
                ApprovalRequest.expires_at > now,
            )
        )
        total = query.count()
        items = query.order_by(ApprovalRequest.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def list_all_approvals(
        db: Session,
        status: ApprovalStatus | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ApprovalRequest], int]:
        """Fetch paginated approval requests with optional status filter."""
        query = db.query(ApprovalRequest)
        if status:
            query = query.filter(ApprovalRequest.status == status)
        total = query.count()
        items = query.order_by(ApprovalRequest.created_at.desc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def expire_old_approvals(db: Session) -> int:
        """Mark all expired pending approval requests as EXPIRED."""
        now = datetime.utcnow()
        expired_requests = (
            db.query(ApprovalRequest)
            .filter(
                ApprovalRequest.status == ApprovalStatus.PENDING,
                ApprovalRequest.expires_at <= now,
            )
            .all()
        )
        count = 0
        for req in expired_requests:
            req.status = ApprovalStatus.EXPIRED
            req.updated_at = now
            AuditService.log_request(
                db=db,
                request_id=req.id,
                agent_id=req.agent_id,
                tool_name=req.tool_name,
                arguments_ref=req.arguments_hash,
                policy_decision=PolicyDecision.REQUIRE_APPROVAL,
                risk_level=req.risk_level,
                execution_status=ExecutionStatus.EXPIRED,
            )
            count += 1
        db.commit()
        return count

    @staticmethod
    def verify_approval_still_valid(
        db: Session,
        request_id: UUID,
        arguments: dict[str, Any],
    ) -> ApprovalRequest:
        """Verify an approval request is APPROVED, not expired, and matches argument hash."""
        req = ApprovalService.get_approval_request(db, request_id)

        if req.status != ApprovalStatus.APPROVED:
            raise AuthorizationError(f"Approval status is '{req.status.value}', expected 'APPROVED'.")

        if req.expires_at < datetime.utcnow():
            req.status = ApprovalStatus.EXPIRED
            db.commit()
            raise ApprovalExpiredError("Approval has expired.")

        incoming_hash = hash_arguments(arguments)
        if incoming_hash != req.arguments_hash:
            raise IntegrityError("Supplied arguments do not match the cryptographic hash of the approved request.")

        return req
