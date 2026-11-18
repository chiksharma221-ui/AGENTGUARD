"""User and Role Pydantic V2 Schemas."""

from datetime import datetime
from typing import Annotated
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator

# Simple email type without requiring the email-validator package
EmailStr = Annotated[str, Field(pattern=r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')]


class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=64)
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RoleCreate(RoleBase):
    pass


class RoleResponse(RoleBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True
    is_superuser: bool = False


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    role_names: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    is_superuser: bool | None = None


class UserResponse(UserBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    roles: list[RoleResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserWithRoles(UserResponse):
    pass


class UserListResponse(BaseModel):
    total: int
    items: list[UserResponse]


class UserRoleAssignRequest(BaseModel):
    role_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str
