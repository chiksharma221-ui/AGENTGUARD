"""FastAPI Middlewares: Request Correlation, Security Headers, and Access Logging."""

import logging
import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("agentguard.access")
logging.basicConfig(level=logging.INFO)

# Global rate limiter instance keyed by client IP
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assigns or propagates a unique correlation ID for every inbound request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())

        # Attach to request state for access in endpoints
        request.state.request_id = request_id

        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces strict HTTP response headers against OWASP web vulnerabilities."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Emits structured access telemetry capturing execution duration and status."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        request_id = getattr(request.state, "request_id", "-")

        try:
            response: Response = await call_next(request)
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(
                "%s %s -> status=%d duration=%.2fms [request_id=%s client=%s]",
                request.method,
                request.url.path,
                response.status_code,
                process_time_ms,
                request_id,
                request.client.host if request.client else "unknown",
            )
            response.headers["X-Response-Time-Ms"] = str(process_time_ms)
            return response
        except Exception as exc:
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "%s %s -> FAILED: %s duration=%.2fms [request_id=%s client=%s]",
                request.method,
                request.url.path,
                str(exc),
                process_time_ms,
                request_id,
                request.client.host if request.client else "unknown",
            )
            raise exc
