"""Payload Integrity, Hashing, and HMAC Signing Service."""

import hmac
import hashlib
import uuid
from typing import Any
from app.config import settings
from app.core.security import hash_arguments


class IntegrityService:
    """Service providing request signing and payload tamper detection."""

    @staticmethod
    def hash_arguments(args: dict[str, Any]) -> str:
        """Produce canonical SHA-256 digest of request arguments."""
        return hash_arguments(args)

    @staticmethod
    def verify_arguments(args: dict[str, Any], expected_hash: str) -> bool:
        """Check whether actual argument payload matches expected hash digest."""
        computed = hash_arguments(args)
        return hmac.compare_digest(computed, expected_hash)

    @staticmethod
    def generate_request_id() -> str:
        """Generate a cryptographically random UUID4 string."""
        return str(uuid.uuid4())

    @staticmethod
    def sign_request(request_id: str, args_hash: str, agent_id: str) -> str:
        """Compute HMAC-SHA256 signature for a tool execution request."""
        message = f"{request_id}:{args_hash}:{agent_id}".encode("utf-8")
        key = settings.SECRET_KEY.encode("utf-8")
        return hmac.new(key, message, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_request_signature(
        request_id: str,
        args_hash: str,
        agent_id: str,
        signature: str,
    ) -> bool:
        """Verify HMAC-SHA256 signature against request parameters."""
        expected = IntegrityService.sign_request(request_id, args_hash, agent_id)
        return hmac.compare_digest(expected, signature)
