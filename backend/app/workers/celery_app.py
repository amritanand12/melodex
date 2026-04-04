"""
Celery worker configuration and download tasks.
Designed for horizontal scaling – stateless workers.
"""
import asyncio
from datetime import datetime, timezone
from typing import Any

import structlog
from celery import Celery
from celery.signals import worker_process_init
from sqlalchemy import select, update

from app.core.config import settings

log = structlog.get_logger()

# ── Celery App ─────────────────────────────────────────────────────────────────
celery_app = Celery(
    "melodex",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Task behavior
    task_acks_late=True,           # Ack after completion (prevents message loss on crash)
    task_reject_on_worker_lost=True,
    task_track_started=True,
    task_time_limit=3600,          # 1hr hard limit per task
    task_soft_time_limit=3300,     # 55min soft limit (triggers SoftTimeLimitExceeded)
    # Worker
    worker_prefetch_multiplier=1,  # CRITICAL: 1 task at a time per worker slot
    worker_max_tasks_per_child=100, # Recycle workers to prevent memory leaks (yt-dlp can leak)
    # Result expiry
    result_expires=86400,          # Keep results 24h
    # Queues
    task_routes={
        "app.workers.celery_app.download_task": {"queue": "downloads"},
        "app.workers.celery_app.fetch_metadata_task": {"queue": "metadata"},
        "app.workers.celery_app.cleanup_task": {"queue": "cleanup"},
    },
    # Beat schedule
    beat_schedule={
        "cleanup-expired-files": {
            "task": "app.workers.celery_app.cleanup_task",
            "schedule": 3600.0,  # Every hour
        },
        "update-ytdlp": {
            "task": "app.workers.celery_app.update_ytdlp_task",
            "schedule": 86400.0,  # Daily
        },
    },
)


def _get_sync_db():
    """Get synchronous database session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Use sync engine for workers
    sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
    engine = create_engine(sync_url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    return Session()


def _get_sync_redis():
    """Get synchronous Redis client for workers."""
    import redis
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _publish_progress(redis_client, job_id: str, session_id: str, data: dict):
    """Publish progress update to Redis pub/sub for WebSocket relay."""
    import json
    channel = f"session:{session_id}"
    message = {"type": "progress", "job_id": job_id, **data}
    redis_client.publish(channel, json.dumps(message, default=str))


# ── Tasks ──────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.workers.celery_app.download_task",
    max_retries=3,
    default_retry_delay=30,
    queue="downloads",
)
def download_task(self, job_id: str, session_id: str):
    """
    Main download task. Runs in a Celery worker process.
    Updates database and emits progress via Redis pub/sub.
    """
    from app.models.download import DownloadJob, JobStatus
    from app.services.ytdlp_service import YtDlpService

    db = _get_sync_db()
    redis_client = _get_sync_redis()

    def emit(status: str, progress: float = 0.0, **kwargs):
        _publish_progress(redis_client, job_id, session_id, {
            "status": status,
            "progress": progress,
            **kwargs,
        })

    try:
        # Load job
        job = db.get(DownloadJob, job_id)
        if not job:
            log.error("download_task.job_not_found", job_id=job_id)
            return

        if job.status == JobStatus.CANCELLED:
            log.info("download_task.cancelled_before_start", job_id=job_id)
            return

        # Mark as downloading
        job.status = JobStatus.DOWNLOADING
        job.started_at = datetime.now(timezone.utc)
        job.celery_task_id = self.request.id
        db.commit()
        emit(JobStatus.DOWNLOADING, 0.0)

        def progress_callback(pct: float, stage: str):
            job.progress = pct
            job.status = JobStatus.CONVERTING if stage == "converting" else JobStatus.DOWNLOADING
            db.commit()
            emit(job.status, pct)

        # ── Core download ──────────────────────────────────────────────
        result = YtDlpService.download_sync(
            url=job.url,
            job_id=job_id,
            fmt=job.format,
            quality=job.quality,
            progress_callback=progress_callback,
        )

        # Update job with results
        from datetime import timedelta
        job.status = JobStatus.COMPLETED
        job.progress = 100.0
        job.file_path = result["file_path"]
        job.file_size = result["file_size"]
        job.title = result.get("title") or job.title
        job.artist = result.get("artist") or job.artist
        job.duration = result.get("duration") or job.duration
        job.completed_at = datetime.now(timezone.utc)
        job.expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.MAX_FILE_AGE_HOURS)
        # Relative download URL served by nginx/backend
        job.download_url = f"/api/v1/downloads/{job_id}/file"
        db.commit()

        emit(JobStatus.COMPLETED, 100.0, download_url=job.download_url, title=job.title, file_size=job.file_size)
        log.info("download_task.success", job_id=job_id, title=job.title)

    except Exception as exc:
        log.exception("download_task.failed", job_id=job_id, error=str(exc))
        # Retry on transient errors
        try:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries * 10)
        except self.MaxRetriesExceededError:
            job = db.get(DownloadJob, job_id)
            if job:
                from app.services.ytdlp_service import _friendly_error
                job.status = JobStatus.FAILED
                job.error_message = _friendly_error(str(exc))
                job.progress = 0.0
                db.commit()
                emit(JobStatus.FAILED, 0.0, error=job.error_message)
    finally:
        db.close()


@celery_app.task(
    name="app.workers.celery_app.fetch_metadata_task",
    queue="metadata",
    time_limit=60,
)
def fetch_metadata_task(job_id: str, session_id: str):
    """Fetch metadata for a job and update the DB."""
    from app.models.download import DownloadJob, JobStatus
    from app.services.ytdlp_service import YtDlpService

    db = _get_sync_db()
    redis_client = _get_sync_redis()

    try:
        job = db.get(DownloadJob, job_id)
        if not job:
            return

        job.status = JobStatus.FETCHING_META
        db.commit()

        # Run async metadata fetch in sync context
        meta = YtDlpService.fetch_metadata_sync(job.url)

        job.title = meta.get("title", "Unknown")
        job.artist = meta.get("artist", "")
        job.album = meta.get("album", "")
        job.duration = meta.get("duration", 0)
        job.thumbnail_url = meta.get("thumbnail_url", "")
        job.video_id = meta.get("video_id", "")
        job.status = JobStatus.QUEUED
        db.commit()

        _publish_progress(redis_client, job_id, session_id, {
            "type": "metadata",
            "status": JobStatus.QUEUED,
            "title": job.title,
            "thumbnail_url": job.thumbnail_url,
            "duration": job.duration,
            "artist": job.artist,
        })

        # Now dispatch the actual download
        download_task.apply_async(args=[job_id, session_id], queue="downloads")

    except Exception as exc:
        log.exception("fetch_metadata_task.failed", job_id=job_id, error=str(exc))
        from app.services.ytdlp_service import _friendly_error
        job = db.get(DownloadJob, job_id)
        if job:
            job.status = JobStatus.FAILED
            job.error_message = _friendly_error(str(exc))
            db.commit()
            _publish_progress(redis_client, job_id, session_id, {
                "status": JobStatus.FAILED,
                "error": job.error_message,
            })
    finally:
        db.close()


@celery_app.task(
    name="app.workers.celery_app.cleanup_task",
    queue="cleanup",
)
def cleanup_task():
    """Periodic cleanup of expired files and database records."""
    import os
    from pathlib import Path
    from app.models.download import DownloadJob, JobStatus

    db = _get_sync_db()
    try:
        now = datetime.now(timezone.utc)
        expired = db.execute(
            select(DownloadJob).where(
                DownloadJob.expires_at < now,
                DownloadJob.status == JobStatus.COMPLETED,
                DownloadJob.file_path.isnot(None),
            )
        ).scalars().all()

        cleaned = 0
        for job in expired:
            path = Path(job.file_path)
            if path.exists():
                path.unlink()
                cleaned += 1
            job.file_path = None
            job.download_url = None
            job.status = "expired"

        db.commit()
        log.info("cleanup_task.done", files_removed=cleaned)
    finally:
        db.close()


@celery_app.task(
    name="app.workers.celery_app.update_ytdlp_task",
    queue="cleanup",
)
def update_ytdlp_task():
    """Daily yt-dlp self-update to keep YouTube extraction working."""
    import subprocess
    try:
        result = subprocess.run(
            ["pip", "install", "--upgrade", "yt-dlp"],
            capture_output=True, text=True, timeout=120
        )
        log.info("ytdlp_update.done", output=result.stdout.strip())
    except Exception as exc:
        log.error("ytdlp_update.failed", error=str(exc))
