"""FastAPI Dependency Providers for Authentication, Authorization, and DB Sessions."""

from datetime import datetime
from typing import Callable, Optional
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_token, hash_api_key
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    AgentCredentialInvalidError,
    AgentDisabledError,
)
from app.models.user import User
from app.models.agent import Agent, AgentCredential

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token_from_oauth: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and authenticate the user from JWT bearer token."""
    raw_token = auth.credentials if auth else token_from_oauth
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(raw_token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user is currently active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    return current_user


def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token_from_oauth: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Optionally authenticate a user if Bearer token is provided."""
    raw_token = auth.credentials if auth else token_from_oauth
    if not raw_token:
        return None
    try:
        payload = decode_token(raw_token)
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            return None
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None


def require_role(*roles: str) -> Callable[..., User]:
    """Dependency factory checking whether user has at least one of the specified roles."""

    def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.is_superuser:
            return current_user

        user_role_names = {role.name for role in current_user.roles}
        if not any(req_role in user_role_names for req_role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of the roles: {', '.join(roles)}",
            )
        return current_user

    return role_checker


# Common shortcut dependencies
get_current_admin = require_role("Administrator")
get_current_approver_or_admin = require_role("Administrator", "Approver")
get_current_security_or_admin = require_role("Administrator", "SecurityOfficer")
get_current_audit_reader = require_role(
    "Administrator",
    "Developer",
    "SecurityOfficer",
    "Approver",
)


def get_agent_from_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> Agent:
    """Authenticate an AI Agent using the X-API-Key header or Authorization header."""
    api_key = x_api_key
    if not api_key:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("ApiKey "):
            api_key = auth_header.split(" ", 1)[1].strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Agent API key. Provide via X-API-Key header or Authorization: ApiKey <key>.",
        )

    key_hash = hash_api_key(api_key)
    cred = db.query(AgentCredential).filter(AgentCredential.api_key_hash == key_hash).first()

    if not cred or cred.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Agent API key is invalid or has been revoked.",
        )

    if cred.expires_at and cred.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Agent API key has expired.",
        )

    agent = db.query(Agent).filter(Agent.id == cred.agent_id).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent associated with credential not found.",
        )

    if not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent account is deactivated.",
        )

    return agent
