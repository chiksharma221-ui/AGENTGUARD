"""Human-in-the-Loop Approvals API Router."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import (
    get_current_approver_or_admin,
)
from app.core.security import decrypt_arguments
from app.models.approval import ApprovalRequest, ApprovalStatus, DecisionType
from app.models.user import User
from app.schemas.approval import (
    ApprovalDecisionCreate,
    ApprovalDecisionResponse,
    ApprovalListResponse,
    ApprovalRequestResponse,
)
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def _hydrate_approval_response(req: ApprovalRequest) -> ApprovalRequestResponse:
    """Decrypt arguments payload and assemble Pydantic response model."""
    args = None
    try:
        if req.arguments_encrypted:
            args = decrypt_arguments(req.arguments_encrypted)
    except Exception:
        args = {"error": "Failed to decrypt arguments."}

    decision_resp = None
    if req.decision:
        decision_resp = ApprovalDecisionResponse.model_validate(req.decision)

    return ApprovalRequestResponse(
        id=req.id,
        request_hash=req.request_hash,
        tool_id=req.tool_id,
        agent_id=req.agent_id,
        requested_by_user_id=req.requested_by_user_id,
        arguments_hash=req.arguments_hash,
        arguments=args,
        tool_name=req.tool_name,
        status=req.status,
        risk_level=req.risk_level,
        reason=req.reason,
        expires_at=req.expires_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
        decision=decision_resp,
    )


@router.get("", response_model=ApprovalListResponse)
def list_approvals(
    status: ApprovalStatus | None = Query(None, description="Filter by status (e.g. PENDING)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_approver_or_admin),
) -> ApprovalListResponse:
    """List pending and historical approval requests."""
    items, total = ApprovalService.list_all_approvals(db, status=status, skip=skip, limit=limit)
    hydrated = [_hydrate_approval_response(item) for item in items]
    return ApprovalListResponse(total=total, items=hydrated)


@router.get("/history", response_model=ApprovalListResponse)
def list_approval_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_approver_or_admin),
) -> ApprovalListResponse:
    """List concluded approvals (APPROVED, REJECTED, EXPIRED, EXECUTED)."""
    query = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.status != ApprovalStatus.PENDING)
        .order_by(ApprovalRequest.updated_at.desc())
    )
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    hydrated = [_hydrate_approval_response(item) for item in items]
    return ApprovalListResponse(total=total, items=hydrated)


@router.get("/{request_id}", response_model=ApprovalRequestResponse)
def get_approval(
    request_id: UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_approver_or_admin),
) -> ApprovalRequestResponse:
    """Fetch complete details and decrypted arguments for an approval request."""
    req = ApprovalService.get_approval_request(db, request_id)
    return _hydrate_approval_response(req)


@router.post("/{request_id}/decide", response_model=ApprovalDecisionResponse)
async def decide_approval(
    request_id: UUID,
    payload: ApprovalDecisionCreate,
    db: Session = Depends(get_db),
    approver: User = Depends(get_current_approver_or_admin),
) -> ApprovalDecisionResponse:
    """Record an approval or rejection decision (Approver or Administrator only)."""
    decision_record = ApprovalService.decide_approval(
        db=db,
        request_id=request_id,
        approver=approver,
        decision=payload.decision,
        comment=payload.comment,
    )

    # Broadcast decision via WebSocket manager
    from app.routers.ws import ws_manager
    await ws_manager.broadcast({
        "event": "APPROVAL_DECIDED",
        "request_id": str(request_id),
        "decision": payload.decision.value,
        "approver_id": str(approver.id),
        "approver_name": approver.full_name,
    })

    return ApprovalDecisionResponse.model_validate(decision_record)
