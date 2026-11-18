"""AI Agent Management and Credential Provisioning API Router."""

from uuid import UUID
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_admin
from app.models.agent import Agent
from app.models.user import User
from app.schemas.agent import (
    AgentCreate,
    AgentCreatedWithKeyResponse,
    AgentCredentialCreate,
    AgentCredentialCreatedResponse,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)
from app.services.agent_service import AgentService

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("", response_model=AgentListResponse)
def list_agents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AgentListResponse:
    """List all registered AI agents with pagination."""
    items, total = AgentService.list_agents(db, skip=skip, limit=limit)
    return AgentListResponse(total=total, items=items)


@router.post("", response_model=AgentCreatedWithKeyResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AgentCreatedWithKeyResponse:
    """Register a new AI agent and return its initial API key (shown once)."""
    agent, raw_api_key = AgentService.create_agent(db, payload)
    return AgentCreatedWithKeyResponse(
        agent=AgentResponse.model_validate(agent),
        api_key=raw_api_key,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Agent:
    """Retrieve details and active credentials for a registered agent."""
    return AgentService.get_agent(db, agent_id)


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(
    agent_id: UUID,
    payload: AgentUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Agent:
    """Update agent metadata and properties (Administrator only)."""
    return AgentService.update_agent(db, agent_id, payload)


@router.post("/{agent_id}/toggle", response_model=AgentResponse)
def toggle_agent(
    agent_id: UUID,
    is_active: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> Agent:
    """Enable or disable an AI agent (Administrator only)."""
    return AgentService.toggle_agent(db, agent_id, is_active)


@router.delete("/{agent_id}/credentials", status_code=status.HTTP_200_OK)
def revoke_agent_credentials(
    agent_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    """Revoke all active credentials for an agent (Administrator only)."""
    AgentService.revoke_agent_credentials(db, agent_id)
    return {"message": "All API keys for this agent have been successfully revoked."}


@router.post("/{agent_id}/credentials", response_model=AgentCredentialCreatedResponse, status_code=status.HTTP_201_CREATED)
def generate_agent_credential(
    agent_id: UUID,
    payload: AgentCredentialCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> AgentCredentialCreatedResponse:
    """Provision a new API key credential for an existing agent (Administrator only)."""
    credential, raw_key = AgentService.generate_new_credential(
        db=db,
        agent_id=agent_id,
        label=payload.label,
        expires_at=payload.expires_at,
    )
    return AgentCredentialCreatedResponse(
        credential=credential,
        api_key=raw_key,
    )
