import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class JobStatus(str, Enum):
    PENDING = "pending"
    FETCHING_META = "fetching_meta"
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    TAGGING = "tagging"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    DUPLICATE = "duplicate"


class AudioQuality(str, Enum):
    LOW = "128"
    MEDIUM = "192"
    HIGH = "320"


class DownloadFormat(str, Enum):
    MP3 = "mp3"
    MP4 = "mp4"


class DownloadJob(Base):
    __tablename__ = "download_jobs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Source
    url: Mapped[str] = mapped_column(Text, nullable=False)
    video_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    playlist_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Metadata
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    artist: Mapped[str | None] = mapped_column(String(255), nullable=True)
    album: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)  # seconds
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Download config
    format: Mapped[str] = mapped_column(String(10), default=DownloadFormat.MP3)
    quality: Mapped[str] = mapped_column(String(5), default=AudioQuality.HIGH)

    # Status
    status: Mapped[str] = mapped_column(String(30), default=JobStatus.PENDING, index=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)

    # Output
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)  # bytes
    download_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_download_jobs_session_status", "session_id", "status"),
        Index("ix_download_jobs_video_format", "video_id", "format", "quality"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "url": self.url,
            "video_id": self.video_id,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "thumbnail_url": self.thumbnail_url,
            "format": self.format,
            "quality": self.quality,
            "status": self.status,
            "progress": self.progress,
            "error_message": self.error_message,
            "file_size": self.file_size,
            "download_url": self.download_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
