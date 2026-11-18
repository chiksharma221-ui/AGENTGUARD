"""Authentication, User Registration, and Role Management Service."""

from uuid import UUID
from sqlalchemy.orm import Session
from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.models.user import Role, User, UserRole
from app.schemas.user import TokenResponse, UserCreate


class AuthService:
    """Service providing user authentication and authorization logic."""

    @staticmethod
    def authenticate_user(
        db: Session,
        email: str,
        password: str,
    ) -> User | None:
        """Verify user credentials against email and bcrypt password hash."""
        user = db.query(User).filter(User.email == email.strip().lower()).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def create_user_tokens(user: User) -> TokenResponse:
        """Generate JWT access and refresh token pair for authenticated user."""
        token_data = {"sub": str(user.id), "email": user.email}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
        """Issue new access token using a valid, non-expired refresh token."""
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise AuthenticationError("Provided token is not a refresh token.")
            user_id = payload.get("sub")
            if not user_id:
                raise AuthenticationError("Invalid token payload.")
        except Exception:
            raise AuthenticationError("Refresh token is invalid or expired.")

        user = db.query(User).filter(User.id == UUID(user_id)).first()
        if not user or not user.is_active:
            raise AuthenticationError("User is inactive or no longer exists.")

        return AuthService.create_user_tokens(user)

    @staticmethod
    def register_user(db: Session, user_create: UserCreate) -> User:
        """Create new user account and attach initial roles."""
        existing = (
            db.query(User)
            .filter(User.email == user_create.email.strip().lower())
            .first()
        )
        if existing:
            raise AuthorizationError("A user with this email address already exists.")

        hashed = get_password_hash(user_create.password)
        user = User(
            email=user_create.email.strip().lower(),
            hashed_password=hashed,
            full_name=user_create.full_name.strip(),
            is_active=user_create.is_active,
            is_superuser=user_create.is_superuser,
        )
        db.add(user)
        db.flush()

        # Attach roles if specified
        for role_name in user_create.role_names:
            role = db.query(Role).filter(Role.name == role_name).first()
            if role:
                user_role = UserRole(user_id=user.id, role_id=role.id)
                db.add(user_role)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def assign_role(db: Session, user_id: UUID, role_name: str) -> UserRole:
        """Grant a designated role to a user."""
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            raise AuthorizationError(f"Role '{role_name}' does not exist.")

        existing = (
            db.query(UserRole)
            .filter(UserRole.user_id == user_id, UserRole.role_id == role.id)
            .first()
        )
        if existing:
            return existing

        user_role = UserRole(user_id=user_id, role_id=role.id)
        db.add(user_role)
        db.commit()
        return user_role

    @staticmethod
    def remove_role(db: Session, user_id: UUID, role_id: UUID) -> bool:
        """Revoke a role from a user."""
        ur = (
            db.query(UserRole)
            .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
            .first()
        )
        if ur:
            db.delete(ur)
            db.commit()
            return True
        return False

    @staticmethod
    def get_user_roles(db: Session, user_id: UUID) -> list[Role]:
        """Fetch all RBAC roles granted to a given user."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        return list(user.roles)

    @staticmethod
    def has_role(user: User, role_name: str) -> bool:
        """Check whether user holds a specific role name (or superuser)."""
        if user.is_superuser:
            return True
        return any(r.name == role_name for r in user.roles)

    @staticmethod
    def has_permission(user: User, permission: str) -> bool:
        """Check whether user holds a specific permission across all roles."""
        if user.is_superuser:
            return True
        for role in user.roles:
            if "*" in role.permissions or permission in role.permissions:
                return True
        return False
