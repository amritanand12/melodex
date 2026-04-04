"""
Melodex – Production-grade YouTube Music Downloader
FastAPI application entry point
"""
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api import downloads, health, metadata, queue, websocket
from app.core.config import settings
from app.core.database import init_db
from app.core.logging import configure_logging

log = structlog.get_logger()

configure_logging()

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("melodex.startup", version="1.0.0", env=settings.ENVIRONMENT)
    await init_db()
    yield
    log.info("melodex.shutdown")


app = FastAPI(
    title="Melodex API",
    description="Production-grade YouTube Music Downloader & Manager",
    version="1.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── Middleware ────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.perf_counter() - start)*1000:.2f}ms"
    response.headers["X-Powered-By"] = "Melodex/1.0"
    return response


# ─── Prometheus metrics ────────────────────────────────────────────────────────
Instrumentator(
    should_group_status_codes=True,
    excluded_handlers=["/api/health"],
).instrument(app).expose(app, endpoint="/metrics")

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(metadata.router, prefix="/api/v1", tags=["metadata"])
app.include_router(queue.router, prefix="/api/v1", tags=["queue"])
app.include_router(downloads.router, prefix="/api/v1", tags=["downloads"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
