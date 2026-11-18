"""Domain Exception Hierarchy for AgentGuard."""

from typing import Any


class AgentGuardException(Exception):
    """Base exception for all domain errors within AgentGuard."""

    def __init__(
        self,
        message: str = "An internal AgentGuard error occurred.",
        status_code: int = 500,
        extra: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.extra = extra or {}


class AuthenticationError(AgentGuardException):
    """Raised when authentication credentials are missing, invalid, or expired."""

    def __init__(self, message: str = "Invalid or expired authentication credentials."):
        super().__init__(message=message, status_code=401)


class AuthorizationError(AgentGuardException):
    """Raised when the caller lacks required permissions or roles."""

    def __init__(self, message: str = "You do not have permission to perform this action."):
        super().__init__(message=message, status_code=403)


class AgentNotFoundError(AgentGuardException):
    """Raised when an agent ID or credential cannot be found."""

    def __init__(self, message: str = "Specified agent not found."):
        super().__init__(message=message, status_code=404)


class AgentDisabledError(AgentGuardException):
    """Raised when an inactive agent attempts gateway execution."""

    def __init__(self, message: str = "The specified agent is currently disabled."):
        super().__init__(message=message, status_code=403)


class AgentCredentialInvalidError(AgentGuardException):
    """Raised when an API key is invalid, revoked, or expired."""

    def __init__(self, message: str = "Agent API key is invalid, expired, or revoked."):
        super().__init__(message=message, status_code=401)


class ToolNotFoundError(AgentGuardException):
    """Raised when a requested tool does not exist in registry."""

    def __init__(self, message: str = "Requested tool was not found in registry."):
        super().__init__(message=message, status_code=404)


class ToolDisabledError(AgentGuardException):
    """Raised when an invocation targets a disabled tool."""

    def __init__(self, message: str = "Requested tool is currently disabled."):
        super().__init__(message=message, status_code=403)


class PolicyDeniedError(AgentGuardException):
    """Raised when a governance policy explicitly or by default denies execution."""

    def __init__(self, reason: str = "Execution denied by governance policy."):
        super().__init__(
            message=reason,
            status_code=403,
            extra={"reason": reason},
        )


class ApprovalRequiredError(AgentGuardException):
    """Raised when a policy mandates human approval prior to tool execution."""

    def __init__(
        self,
        request_id: str,
        reason: str = "Tool invocation requires administrative approval.",
    ):
        super().__init__(
            message=reason,
            status_code=202,
            extra={"request_id": request_id, "reason": reason},
        )
        self.request_id = request_id
        self.reason = reason


class ApprovalNotFoundError(AgentGuardException):
    """Raised when an approval request ID does not match any record."""

    def __init__(self, message: str = "Approval request not found."):
        super().__init__(message=message, status_code=404)


class ApprovalExpiredError(AgentGuardException):
    """Raised when an approval request has exceeded its validity TTL."""

    def __init__(self, message: str = "Approval request has expired."):
        super().__init__(message=message, status_code=410)


class ApprovalAlreadyDecidedError(AgentGuardException):
    """Raised when attempting to decide an approval that is no longer pending."""

    def __init__(self, message: str = "Approval request has already been decided."):
        super().__init__(message=message, status_code=409)


class IntegrityError(AgentGuardException):
    """Raised when payload hash, cryptographic signature, or hash chain verification fails."""

    def __init__(self, detail: str = "Payload or audit chain integrity violation detected."):
        super().__init__(
            message=detail,
            status_code=400,
            extra={"detail": detail},
        )


class SandboxViolationError(AgentGuardException):
    """Raised when a tool attempts to escape the designated filesystem sandbox."""

    def __init__(self, message: str = "Filesystem path traversal outside sandbox detected."):
        super().__init__(message=message, status_code=403)


class RateLimitError(AgentGuardException):
    """Raised when client exceeds rate limits."""

    def __init__(self, message: str = "Rate limit exceeded. Please retry later."):
        super().__init__(message=message, status_code=429)
