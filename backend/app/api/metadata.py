from fastapi import APIRouter, HTTPException

from app.schemas.download import MetadataRequest, MetadataResponse
from app.services.ytdlp_service import YtDlpService, get_ytdlp_version

router = APIRouter()


@router.post("/metadata", response_model=MetadataResponse)
async def get_metadata(body: MetadataRequest):
    """
    Fetch metadata for a YouTube URL (video or playlist).
    Used for previewing before queuing.
    Cached in Redis for 1 hour.
    """
    try:
        meta = await YtDlpService.fetch_metadata(body.url)
        return MetadataResponse(
            video_id=meta.get("video_id"),
            title=meta.get("title", "Unknown"),
            artist=meta.get("artist"),
            duration=meta.get("duration"),
            thumbnail_url=meta.get("thumbnail_url"),
            is_playlist=meta.get("is_playlist", False),
            playlist_count=meta.get("playlist_count"),
            url=meta.get("url", body.url),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Metadata fetch failed: {str(e)[:200]}")


@router.get("/metadata/ytdlp-version")
async def ytdlp_version():
    """Returns current yt-dlp version (useful for debugging)."""
    return {"version": get_ytdlp_version()}
