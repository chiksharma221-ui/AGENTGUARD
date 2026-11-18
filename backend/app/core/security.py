"""Security Utilities: Passwords, JWT Tokens, API Keys, Hashes, and Encryption."""

import base64
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta
from typing import Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a raw password against its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Compute bcrypt hash of a password."""
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Generate a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    """Generate a signed JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and cryptographically verify a JWT token.
    
    Raises:
        JWTError: If token is malformed, expired, or invalid.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def generate_api_key() -> tuple[str, str, str]:
    """Generate a secure agent API key.
    
    Returns:
        tuple[str, str, str]: (full_key, key_prefix, hashed_key)
        - full_key: e.g. "ag_live_7c8d9e..." (returned only once to caller)
        - key_prefix: e.g. "ag_live" or first 8 chars for identification
        - hashed_key: SHA-256 hash stored in database for verification
    """
    raw_random = secrets.token_urlsafe(32)
    full_key = f"ag_{raw_random}"
    prefix = full_key[:8]
    hashed_key = hashlib.sha256(full_key.encode("utf-8")).hexdigest()
    return full_key, prefix, hashed_key


def hash_api_key(key: str) -> str:
    """Hash an API key with SHA-256 for database lookup."""
    return hashlib.sha256(key.strip().encode("utf-8")).hexdigest()


def canonicalize_json(data: Any) -> str:
    """Produce deterministic, sorted JSON representation."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


def hash_arguments(args: dict[str, Any]) -> str:
    """Calculate SHA-256 hash of canonicalized JSON arguments."""
    canonical = canonicalize_json(args)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _get_encryption_key() -> bytes:
    """Derive 32-byte key for AES-256 from application SECRET_KEY."""
    return hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()


def encrypt_arguments(args: dict[str, Any]) -> str:
    """Encrypt arguments dictionary using AES-256-GCM.
    
    Returns:
        Base64-encoded string combining 12-byte nonce and ciphertext.
    """
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    payload_bytes = canonicalize_json(args).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, payload_bytes, None)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode("utf-8")


def decrypt_arguments(encrypted: str) -> dict[str, Any]:
    """Decrypt Base64-encoded AES-256-GCM arguments payload."""
    raw = base64.b64decode(encrypted.encode("utf-8"))
    nonce = raw[:12]
    ciphertext = raw[12:]
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(decrypted_bytes.decode("utf-8"))
