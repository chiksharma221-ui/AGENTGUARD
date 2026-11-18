"""User and RBAC Administration API Router."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_active_user, get_current_admin
from app.core.security import get_password_hash
from app.models.user import Role, User
from app.schemas.user import (
    RoleResponse,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserRoleAssignRequest,
    UserUpdate,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> UserListResponse:
    """List all registered users (Administrator only)."""
    query = db.query(User)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return UserListResponse(total=total, items=users)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> User:
    """Create a new user account (Administrator only)."""
    return AuthService.register_user(db, payload)


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Retrieve details for a specific user account."""
    if not current_user.is_superuser and current_user.id != user_id:
        # Check admin role
        if not any(r.name == "Administrator" for r in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You may only inspect your own user record.",
            )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Update user information (Admin or account owner)."""
    is_admin = current_user.is_superuser or any(r.name == "Administrator" for r in current_user.roles)
    if not is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You may only update your own user record.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if payload.email is not None:
        user.email = payload.email.strip().lower()
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.password is not None:
        user.hashed_password = get_password_hash(payload.password)

    # Only admins can alter account status and superuser privilege
    if is_admin:
        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.is_superuser is not None:
            user.is_superuser = payload.is_superuser

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> None:
    """Delete a user account (Administrator only)."""
    if current_admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own active account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    db.delete(user)
    db.commit()


@router.get("/{user_id}/roles", response_model=list[RoleResponse])
def get_user_roles(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> list[Role]:
    """List roles assigned to a user (Administrator only)."""
    return AuthService.get_user_roles(db, user_id)


@router.post("/{user_id}/roles", status_code=status.HTTP_201_CREATED)
def assign_role_to_user(
    user_id: UUID,
    payload: UserRoleAssignRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    """Grant a role to a user (Administrator only)."""
    AuthService.assign_role(db, user_id, payload.role_name)
    return {"message": f"Role '{payload.role_name}' successfully assigned to user."}


@router.delete("/{user_id}/roles/{role_id}", status_code=status.HTTP_200_OK)
def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
) -> dict[str, str]:
    """Revoke a role from a user (Administrator only)."""
    removed = AuthService.remove_role(db, user_id, role_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User role mapping not found.")
    return {"message": "Role successfully revoked from user."}
