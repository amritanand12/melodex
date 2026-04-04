"""
Queue management endpoints.
All heavy lifting happens in Celery workers.
"""
import uuid
from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import cache
from app.models.download import DownloadJob, JobStatus
from app.schemas.download import JobResponse, QueueStatsResponse, SubmitResponse, SubmitUrlsRequest
from app.services.ytdlp_service import YtDlpService
from app.workers.celery_app import fetch_metadata_task

log = structlog.get_logger()
router = APIRouter()


@router.post("/queue/submit", response_model=SubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_urls(
    request: Request,
    body: SubmitUrlsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit one or more YouTube URLs for downloading.
    Supports single videos and playlists (auto-expanded).
    Returns immediately with job IDs – actual download is async.
    """
    session_id = body.session_id
    jobs_created: List[DownloadJob] = []

    for url in body.urls:
        # Check for playlist → expand
        is_playlist = "list=" in url and "watch?v=" not in url

        if is_playlist:
            try:
                entries = await YtDlpService.expand_playlist(url)
            except Exception as e:
                log.warning("playlist.expand_failed", url=url, error=str(e))
                entries = [{"url": url}]
        else:
            entries = [{"url": url}]

        for entry in entries:
            entry_url = entry.get("url", url)
            video_id = entry.get("video_id")

            # Duplicate check: same video+format+quality in this session
            if video_id:
                existing = await db.execute(
                    select(DownloadJob).where(
                        DownloadJob.session_id == session_id,
                        DownloadJob.video_id == video_id,
                        DownloadJob.format == body.format,
                        DownloadJob.quality == body.quality,
                        DownloadJob.status.notin_([JobStatus.FAILED, JobStatus.CANCELLED]),
                    ).limit(1)
                )
                if existing.scalar_one_or_none():
                    log.info("queue.duplicate_skipped", video_id=video_id, session_id=session_id)
                    continue

            job = DownloadJob(
                id=str(uuid.uuid4()),
                url=entry_url,
                video_id=video_id,
                title=entry.get("title"),
                duration=entry.get("duration"),
                thumbnail_url=entry.get("thumbnail_url"),
                session_id=session_id,
                format=body.format,
                quality=body.quality,
                status=JobStatus.PENDING,
            )
            db.add(job)
            jobs_created.append(job)

    if not jobs_created:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All URLs are duplicates already in your queue.",
        )

    await db.flush()

    # Dispatch Celery tasks (metadata fetch → download chained internally)
    for job in jobs_created:
        fetch_metadata_task.apply_async(
            args=[job.id, session_id],
            queue="metadata",
        )
        log.info("queue.job_dispatched", job_id=job.id, url=job.url)

    return SubmitResponse(
        jobs=[JobResponse.model_validate(j.to_dict()) for j in jobs_created],
        session_id=session_id,
        message=f"{len(jobs_created)} job(s) queued successfully.",
    )


@router.get("/queue/{session_id}", response_model=List[JobResponse])
async def get_session_queue(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all jobs for a session (paginated by status)."""
    result = await db.execute(
        select(DownloadJob)
        .where(DownloadJob.session_id == session_id)
        .order_by(DownloadJob.created_at.desc())
        .limit(200)
    )
    jobs = result.scalars().all()
    return [JobResponse.model_validate(j.to_dict()) for j in jobs]


@router.get("/queue/{session_id}/stats", response_model=QueueStatsResponse)
async def get_queue_stats(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get queue statistics for a session."""
    result = await db.execute(
        select(DownloadJob).where(DownloadJob.session_id == session_id)
    )
    jobs = result.scalars().all()
    statuses = [j.status for j in jobs]
    return QueueStatsResponse(
        total=len(jobs),
        pending=statuses.count(JobStatus.PENDING) + statuses.count(JobStatus.QUEUED),
        downloading=statuses.count(JobStatus.DOWNLOADING) + statuses.count(JobStatus.CONVERTING),
        completed=statuses.count(JobStatus.COMPLETED),
        failed=statuses.count(JobStatus.FAILED),
    )


@router.delete("/queue/{session_id}/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(session_id: str, job_id: str, db: AsyncSession = Depends(get_db)):
    """Cancel a pending or downloading job."""
    result = await db.execute(
        select(DownloadJob).where(
            DownloadJob.id == job_id,
            DownloadJob.session_id == session_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.celery_task_id:
        from app.workers.celery_app import celery_app
        celery_app.control.revoke(job.celery_task_id, terminate=True, signal="SIGTERM")

    job.status = JobStatus.CANCELLED
    log.info("queue.job_cancelled", job_id=job_id)
