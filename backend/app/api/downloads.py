"""
Downloads API – file serving, history, ZIP bundling.
"""
import io
import zipfile
from pathlib import Path
from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.download import DownloadJob, JobStatus
from app.schemas.download import JobResponse

log = structlog.get_logger()
router = APIRouter()


@router.get("/downloads/{session_id}", response_model=List[JobResponse])
async def list_downloads(session_id: str, db: AsyncSession = Depends(get_db)):
    """List completed downloads for a session."""
    result = await db.execute(
        select(DownloadJob).where(
            DownloadJob.session_id == session_id,
            DownloadJob.status == JobStatus.COMPLETED,
            DownloadJob.file_path.isnot(None),
        ).order_by(DownloadJob.completed_at.desc())
    )
    jobs = result.scalars().all()
    return [JobResponse.model_validate(j.to_dict()) for j in jobs]


@router.get("/downloads/{job_id}/file")
async def download_file(job_id: str, db: AsyncSession = Depends(get_db)):
    """Serve the downloaded file directly."""
    result = await db.execute(
        select(DownloadJob).where(
            DownloadJob.id == job_id,
            DownloadJob.status == JobStatus.COMPLETED,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Download not found or not completed yet")

    if not job.file_path:
        raise HTTPException(status_code=410, detail="File has expired and been deleted")

    file_path = Path(job.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=410, detail="File has expired and been deleted")

    # Sanitize filename
    safe_title = "".join(c for c in (job.title or "download") if c.isalnum() or c in " -_").strip()
    filename = f"{safe_title}.{job.format}"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="audio/mpeg" if job.format == "mp3" else "video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/downloads/{session_id}/zip")
async def download_zip(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    Bundle all completed downloads for a session into a ZIP.
    Streams the ZIP to avoid memory issues with large collections.
    """
    result = await db.execute(
        select(DownloadJob).where(
            DownloadJob.session_id == session_id,
            DownloadJob.status == JobStatus.COMPLETED,
            DownloadJob.file_path.isnot(None),
        )
    )
    jobs = result.scalars().all()

    if not jobs:
        raise HTTPException(status_code=404, detail="No completed downloads found")

    def iter_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
            for job in jobs:
                path = Path(job.file_path)
                if path.exists():
                    safe_title = "".join(
                        c for c in (job.title or "download") if c.isalnum() or c in " -_"
                    ).strip()
                    arcname = f"{safe_title}.{job.format}"
                    zf.write(path, arcname=arcname)
        buf.seek(0)
        yield buf.read()

    return StreamingResponse(
        iter_zip(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="melodex_downloads.zip"',
        },
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific job's status."""
    result = await db.execute(select(DownloadJob).where(DownloadJob.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job.to_dict())
