"""Governance Policy Administration API Router."""

from uuid import UUID
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import (
    get_current_admin,
    get_current_security_or_admin,
)
from app.models.agent import Agent
from app.models.policy import Policy
from app.models.user import User
from app.schemas.policy import (
    PolicyCreate,
    PolicyEvaluationRequest,
    PolicyEvaluationResult,
    PolicyResponse,
    PolicyUpdate,
)
from app.services.policy_engine import EvaluationContext, policy_engine

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get("", response_model=list[PolicyResponse])
def list_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _sec_user: User = Depends(get_current_security_or_admin),
) -> list[Policy]:
    """List all governance policies ordered by priority."""
    return (
        db.query(Policy)
        .order_by(Policy.priority.asc(), Policy.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
def create_policy(
    payload: PolicyCreate,
    db: Session = Depends(get_db),
    _sec_user: User = Depends(get_current_security_or_admin),
) -> Policy:
    """Create a new security policy rule (Security Officer or Admin)."""
    policy = Policy(
        name=payload.name.strip(),
        description=payload.description,
        tool_id=payload.tool_id,
        tool_name_pattern=payload.tool_name_pattern.strip(),
        operation=payload.operation,
        risk_level=payload.risk_level,
        decision=payload.decision,
        conditions=payload.conditions,
        priority=payload.priority,
        is_enabled=payload.is_enabled,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(
    policy_id: UUID,
    db: Session = Depends(get_db),
    _sec_user: User = Depends(get_current_security_or_admin),
) -> Policy:
    """Retrieve details of a specific policy rule."""
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found.")
    return policy


@router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: UUID,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
    _sec_user: User = Depends(get_current_security_or_admin),
) -> Policy:
    """Update policy attributes and conditions (Security Officer or Admin)."""
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found.")

    if payload.name is not None:
        policy.name = payload.name.strip()
    if payload.description is not None:
        policy.description = payload.description
    if payload.tool_id is not None:
        policy.tool_id = payload.tool_id
    if payload.tool_name_pattern is not None:
        policy.tool_name_pattern = payload.tool_name_pattern.strip()
    if payload.operation is not None:
        policy.operation = payload.operation
    if payload.risk_level is not None:
        policy.risk_level = payload.risk_level
    if payload.decision is not None:
        policy.decision = payload.decision
    if payload.conditions is not None:
        policy.conditions = payload.conditions
    if payload.priority is not None:
        policy.priority = payload.priority
    if payload.is_enabled is not None:
        policy.is_enabled = payload.is_enabled

    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(
    policy_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> None:
    """Delete a governance policy (Administrator only)."""
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found.")
    db.delete(policy)
    db.commit()


@router.post("/{policy_id}/toggle", response_model=PolicyResponse)
def toggle_policy(
    policy_id: UUID,
    is_enabled: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    _sec_user: User = Depends(get_current_security_or_admin),
) -> Policy:
    """Enable or disable a policy rule (Security Officer or Admin)."""
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found.")
    policy.is_enabled = is_enabled
    db.commit()
    db.refresh(policy)
    return policy


@router.post("/evaluate", response_model=PolicyEvaluationResult)
def test_policy_evaluation(
    payload: PolicyEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_security_or_admin),
) -> PolicyEvaluationResult:
    """Dry-run test policy evaluation against simulated invocation arguments."""
    agent = None
    if payload.agent_id:
        agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()

    ctx = EvaluationContext(
        tool_name=payload.tool_name,
        operation=payload.operation or "",
        arguments=payload.arguments,
        agent=agent,
        user=current_user,
        risk_level=payload.risk_level.value if payload.risk_level else "",
    )
    res = policy_engine.evaluate(ctx, db)
    return PolicyEvaluationResult(
        decision=res.decision,
        policy_id=UUID(res.policy_id) if res.policy_id else None,
        policy_name=res.policy_name,
        reason=res.reason,
        risk_level=res.risk_level,
    )
