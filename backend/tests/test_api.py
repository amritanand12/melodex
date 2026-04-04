"""
Production test suite for Melodex API.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_submit_invalid_url(client: AsyncClient):
    r = await client.post("/api/v1/queue/submit", json={
        "urls": ["not-a-url"],
        "format": "mp3",
        "quality": "320",
        "session_id": "test-session-12345678",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_submit_non_youtube_url(client: AsyncClient):
    r = await client.post("/api/v1/queue/submit", json={
        "urls": ["https://vimeo.com/123456"],
        "format": "mp3",
        "quality": "320",
        "session_id": "test-session-12345678",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_get_empty_queue(client: AsyncClient):
    r = await client.get("/api/v1/queue/nonexistent-session-id-xyz")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_get_queue_stats(client: AsyncClient):
    r = await client.get("/api/v1/queue/nonexistent-session/stats")
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_format_validation(client: AsyncClient):
    r = await client.post("/api/v1/queue/submit", json={
        "urls": ["https://youtube.com/watch?v=dQw4w9WgXcQ"],
        "format": "flac",       # invalid
        "quality": "320",
        "session_id": "test-session-12345678",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_quality_validation(client: AsyncClient):
    r = await client.post("/api/v1/queue/submit", json={
        "urls": ["https://youtube.com/watch?v=dQw4w9WgXcQ"],
        "format": "mp3",
        "quality": "999",       # invalid
        "session_id": "test-session-12345678",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_too_many_urls(client: AsyncClient):
    r = await client.post("/api/v1/queue/submit", json={
        "urls": [f"https://youtube.com/watch?v=abc{i}" for i in range(60)],
        "format": "mp3",
        "quality": "320",
        "session_id": "test-session-12345678",
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_job_not_found(client: AsyncClient):
    r = await client.get("/api/v1/jobs/nonexistent-job-id-000")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cancel_nonexistent_job(client: AsyncClient):
    r = await client.delete("/api/v1/queue/session123/nonexistent-job")
    assert r.status_code == 404
