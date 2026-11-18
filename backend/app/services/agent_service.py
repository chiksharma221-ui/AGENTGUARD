"""AI Agent Lifecycle and Credential Provisioning Service."""

from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import (
    AgentCredentialInvalidError,
    AgentDisabledError,
    AgentNotFoundError,
)
from app.core.security import generate_api_key, hash_api_key
from app.models.agent import Agent, AgentCredential
from app.schemas.agent import AgentCreate, AgentUpdate


class AgentService:
    """Service handling lifecycle, credentials, and authentication for AI agents."""

    @staticmethod
    def create_agent(
        db: Session,
        agent_create: AgentCreate,
        label: str = "Default Primary Key",
    ) -> tuple[Agent, str]:
        """Register a new AI agent and mint its initial API key.
        
        Returns:
            tuple[Agent, str]: The persisted Agent model and the plaintext API key.
        """
        agent = Agent(
            name=agent_create.name.strip(),
            description=agent_create.description,
            is_active=agent_create.is_active,
            meta=agent_create.metadata,
        )
        db.add(agent)
        db.flush()

        # Generate primary API key
        full_key, prefix, key_hash = generate_api_key()
        credential = AgentCredential(
            agent_id=agent.id,
            api_key_hash=key_hash,
            key_prefix=prefix,
            label=label,
            is_revoked=False,
        )
        db.add(credential)
        db.commit()
        db.refresh(agent)
        return agent, full_key

    @staticmethod
    def get_agent(db: Session, agent_id: UUID) -> Agent:
        """Retrieve agent by primary key or raise AgentNotFoundError."""
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise AgentNotFoundError(f"Agent '{agent_id}' does not exist.")
        return agent

    @staticmethod
    def list_agents(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Agent], int]:
        """Fetch paginated collection of registered agents and total count."""
        query = db.query(Agent)
        total = query.count()
        items = (
            query.order_by(Agent.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return items, total

    @staticmethod
    def update_agent(
        db: Session,
        agent_id: UUID,
        agent_update: AgentUpdate,
    ) -> Agent:
        """Update properties and metadata of an agent."""
        agent = AgentService.get_agent(db, agent_id)
        if agent_update.name is not None:
            agent.name = agent_update.name.strip()
        if agent_update.description is not None:
            agent.description = agent_update.description
        if agent_update.is_active is not None:
            agent.is_active = agent_update.is_active
        if agent_update.metadata is not None:
            agent.meta = agent_update.metadata

        agent.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(agent)
        return agent

    @staticmethod
    def toggle_agent(db: Session, agent_id: UUID, is_active: bool) -> Agent:
        """Enable or disable agent access."""
        agent = AgentService.get_agent(db, agent_id)
        agent.is_active = is_active
        agent.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(agent)
        return agent

    @staticmethod
    def authenticate_agent(db: Session, api_key: str) -> Agent:
        """Verify an inbound API key against active agent credentials."""
        if not api_key:
            raise AgentCredentialInvalidError("Missing API key.")

        key_hash = hash_api_key(api_key)
        cred = (
            db.query(AgentCredential)
            .filter(
                AgentCredential.api_key_hash == key_hash,
                AgentCredential.is_revoked == False,
            )
            .first()
        )
        if not cred:
            raise AgentCredentialInvalidError("Invalid or revoked API key.")

        if cred.expires_at and cred.expires_at < datetime.utcnow():
            raise AgentCredentialInvalidError("API key has expired.")

        agent = db.query(Agent).filter(Agent.id == cred.agent_id).first()
        if not agent or not agent.is_active:
            raise AgentDisabledError("Agent is inactive or deleted.")

        AgentService.update_agent_last_seen(db, agent.id)
        return agent

    @staticmethod
    def revoke_agent_credentials(db: Session, agent_id: UUID) -> bool:
        """Revoke all active credentials for an agent."""
        creds = (
            db.query(AgentCredential)
            .filter(
                AgentCredential.agent_id == agent_id,
                AgentCredential.is_revoked == False,
            )
            .all()
        )
        for c in creds:
            c.is_revoked = True
        db.commit()
        return True

    @staticmethod
    def generate_new_credential(
        db: Session,
        agent_id: UUID,
        label: str,
        expires_at: datetime | None = None,
    ) -> tuple[AgentCredential, str]:
        """Provision an additional API key credential for an agent."""
        agent = AgentService.get_agent(db, agent_id)
        full_key, prefix, key_hash = generate_api_key()
        credential = AgentCredential(
            agent_id=agent.id,
            api_key_hash=key_hash,
            key_prefix=prefix,
            label=label,
            expires_at=expires_at,
            is_revoked=False,
        )
        db.add(credential)
        db.commit()
        db.refresh(credential)
        return credential, full_key

    @staticmethod
    def update_agent_last_seen(db: Session, agent_id: UUID) -> None:
        """Touch last_seen_at timestamp for active agent invocation."""
        db.query(Agent).filter(Agent.id == agent_id).update(
            {"last_seen_at": datetime.utcnow()},
            synchronize_session=False,
        )
        db.commit()
