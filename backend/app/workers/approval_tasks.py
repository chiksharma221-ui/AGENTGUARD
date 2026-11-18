"""Celery Asynchronous Tasks for Approval Request Expiration and Cleanup."""

import logging
from app.database import SessionLocal
from app.services.approval_service import ApprovalService
from app.workers.celery_app import celery_app

logger = logging.getLogger("agentguard.tasks")


@celery_app.task(name="app.workers.approval_tasks.expire_pending_approvals")
def expire_pending_approvals() -> dict[str, int]:
    """Background task sweeping stale PENDING approval requests and transitioning them to EXPIRED."""
    db = SessionLocal()
    try:
        count = ApprovalService.expire_old_approvals(db)
        if count > 0:
            logger.info("Expired %d stale pending approval requests.", count)
        return {"expired_count": count}
    except Exception as exc:
        logger.error("Failed executing expire_pending_approvals task: %s", exc)
        raise exc
    finally:
        db.close()
