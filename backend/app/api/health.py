from datetime import datetime

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.services.ytdlp_service import get_ytdlp_version

log = structlog.get_logger()
router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@router.get("/health/deep")
async def deep_health(db: AsyncSession = Depends(get_db)):
    """Deep health check — verifies DB, Redis, yt-dlp."""
    checks = {}

    # Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Redis
    try:
        r = await get_redis()
        await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # yt-dlp
    checks["ytdlp_version"] = get_ytdlp_version()

    all_ok = all(v == "ok" for k, v in checks.items() if k != "ytdlp_version")
    return {
        "status": "ok" if all_ok else "degraded",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat(),
    }
