from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


class SubmitUrlsRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1, max_length=50)
    format: str = Field(default="mp3", pattern="^(mp3|mp4)$")
    quality: str = Field(default="320", pattern="^(128|192|320)$")
    session_id: str = Field(..., min_length=10, max_length=100)

    @field_validator("urls", mode="before")
    @classmethod
    def validate_urls(cls, v):
        cleaned = []
        for url in v:
            url = url.strip()
            if not url:
                continue
            if not (url.startswith("http://") or url.startswith("https://")):
                raise ValueError(f"Invalid URL: {url}")
            if "youtube.com" not in url and "youtu.be" not in url:
                raise ValueError(f"Only YouTube URLs are supported: {url}")
            cleaned.append(url)
        if not cleaned:
            raise ValueError("No valid URLs provided")
        return cleaned


class JobResponse(BaseModel):
    id: str
    url: str
    video_id: Optional[str]
    title: Optional[str]
    artist: Optional[str]
    duration: Optional[int]
    thumbnail_url: Optional[str]
    format: str
    quality: str
    status: str
    progress: float
    error_message: Optional[str]
    file_size: Optional[int]
    download_url: Optional[str]
    created_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class SubmitResponse(BaseModel):
    jobs: List[JobResponse]
    session_id: str
    message: str


class MetadataRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, v):
        v = v.strip()
        if "youtube.com" not in v and "youtu.be" not in v:
            raise ValueError("Only YouTube URLs are supported")
        return v


class MetadataResponse(BaseModel):
    video_id: Optional[str]
    title: str
    artist: Optional[str]
    duration: Optional[int]
    thumbnail_url: Optional[str]
    is_playlist: bool
    playlist_count: Optional[int]
    url: str


class QueueStatsResponse(BaseModel):
    total: int
    pending: int
    downloading: int
    completed: int
    failed: int
