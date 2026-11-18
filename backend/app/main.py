"""AgentGuard FastAPI Gateway Application Entrypoint."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.core.events import on_shutdown, on_startup
from app.core.exceptions import AgentGuardException
from app.core.middleware import (
    LoggingMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
    limiter,
)
from app.routers import (
    agents,
    approvals,
    audit,
    auth,
    policies,
    tools,
    users,
    ws,
)

logger = logging.getLogger("agentguard.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context managing startup bootstrapping and shutdown."""
    on_startup()
    yield
    on_shutdown()


app = FastAPI(
    title="AgentGuard Gateway",
    description="Production-Grade AI Agent Governance & Secure Execution Gateway",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# Attach SlowAPI rate limiter state
app.state.limiter = limiter

# -------------------------------------------------------------
# Middlewares (Executed in reverse order of addition)
# -------------------------------------------------------------
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Exception Handlers
# -------------------------------------------------------------
@app.exception_handler(AgentGuardException)
async def agentguard_exception_handler(request: Request, exc: AgentGuardException) -> JSONResponse:
    """Format domain exceptions into standard structured HTTP error payloads."""
    content = {
        "error": exc.__class__.__name__,
        "detail": exc.message,
    }
    if exc.extra:
        content.update(exc.extra)
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RateLimitExceeded)
async def ratelimit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exhaustion."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "RateLimitExceeded",
            "detail": f"Rate limit exceeded: {exc.detail}",
        },
    )


# -------------------------------------------------------------
# Routers
# -------------------------------------------------------------
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(policies.router)
app.include_router(approvals.router)
app.include_router(audit.router)
app.include_router(ws.router)


# -------------------------------------------------------------
# Health and Diagnostics Endpoints
# -------------------------------------------------------------
@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Liveness and readiness health probe."""
    return {
        "status": "healthy",
        "service": "AgentGuard Gateway",
        "version": "1.0.0",
    }
