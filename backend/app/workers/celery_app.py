"""Celery Asynchronous Task Application Configuration."""

from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "agentguard_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.approval_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "expire-stale-pending-approvals-every-5-mins": {
            "task": "app.workers.approval_tasks.expire_pending_approvals",
            "schedule": 300.0,  # Run every 5 minutes
        },
    },
)
