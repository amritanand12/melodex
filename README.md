# 🎵 Melodex — Production YouTube Music Downloader

A production-grade, horizontally scalable YouTube audio/video downloader built with FastAPI, Celery, Redis, PostgreSQL, and Next.js.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Users (10,000+)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / WebSocket
                    ┌──────▼──────┐
                    │    Nginx    │  Rate limiting, SSL termination,
                    │ (Reverse    │  load balancing, static files
                    │  Proxy)     │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────▼┐ ┌▼───▼────┐
          │  Next.js    │ │ FastAPI │  3 replicas (horizontal)
          │  Frontend   │ │ Backend │  uvicorn + uvloop
          └─────────────┘ └────┬────┘
                               │ Celery tasks
                    ┌──────────▼──────────┐
                    │     Redis           │
                    │  ┌───────────────┐  │
                    │  │ Broker Queue  │  │  Task queues: downloads,
                    │  │ Result Cache  │  │  metadata, cleanup
                    │  │ Pub/Sub (WS)  │  │
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Celery Workers     │  5 replicas, auto-scaling
                    │  ┌───────────────┐  │  yt-dlp + ffmpeg
                    │  │  yt-dlp       │  │  ID3 tag embedding
                    │  │  ffmpeg       │  │  MP3/MP4 conversion
                    │  └───────────────┘  │
                    └──────────┬──────────┘
                               │
               ┌───────────────▼───────────────┐
               │         PostgreSQL             │
               │  download_jobs table           │
               │  Async SQLAlchemy              │
               └───────────────────────────────┘
```

---

## Features

| Feature | Implementation |
|---|---|
| Multi-URL input | Textarea + drag-drop .txt files |
| Playlist expansion | yt-dlp extract_flat |
| Real-time progress | WebSocket + Redis pub/sub |
| MP3 / MP4 | yt-dlp + ffmpeg postprocessors |
| Quality: 128/192/320kbps | yt-dlp audio bitrate selector |
| ID3 tags | FFmpegMetadata + EmbedThumbnail |
| Duplicate detection | DB unique check per session |
| Job cancellation | Celery task revoke |
| ZIP download | Python zipfile streaming |
| Auto cleanup | Celery Beat (hourly) |
| Daily yt-dlp update | Celery Beat (daily) |
| Rate limiting | SlowAPI (per IP) + Nginx |
| Caching | Redis (metadata 1h TTL) |
| Observability | Prometheus + Grafana |
| Horizontal scaling | Docker Compose replicas |

---

## Quick Start (Local Development)

```bash
git clone <repo>
cd melodex
./scripts/dev.sh
```

Then open:
- **App**: http://localhost:3000
- **API docs**: http://localhost:8000/api/docs
- **Celery monitor**: http://localhost:5555

---

## Production Deployment

### Prerequisites
- Docker + Docker Compose v2
- 4+ CPU cores, 8GB+ RAM for 10k users
- (Optional) AWS account for S3 storage

### Steps

```bash
# 1. Configure
cp .env.example .env
nano .env  # Set SECRET_KEY, DATABASE_URL, etc.

# 2. Deploy
./scripts/deploy.sh

# 3. Scale workers for more throughput
docker compose up -d --scale worker=10

# 4. Monitor
open http://localhost:3001  # Grafana (admin/melodex_grafana)
```

### Scaling to 10,000+ Users

| Component | Default | Recommended (10k users) |
|---|---|---|
| Backend replicas | 3 | 5–10 |
| Celery workers | 5 | 20–50 |
| Worker concurrency | 4 | 4 (keep low — yt-dlp is CPU-bound) |
| Redis maxmemory | 512MB | 2–4GB |
| PostgreSQL max_connections | 200 | 500 |
| Nginx worker_connections | 4096 | 16384 |

```bash
# Scale up:
docker compose up -d \
  --scale backend=8 \
  --scale worker=30
```

---

## API Reference

### POST `/api/v1/queue/submit`
Submit URLs for download.
```json
{
  "urls": ["https://youtube.com/watch?v=..."],
  "format": "mp3",
  "quality": "320",
  "session_id": "uuid-v4-string"
}
```

### GET `/api/v1/queue/{session_id}`
List all jobs for a session.

### GET `/api/v1/queue/{session_id}/stats`
Queue statistics (total, pending, downloading, completed, failed).

### DELETE `/api/v1/queue/{session_id}/{job_id}`
Cancel a job.

### GET `/api/v1/downloads/{job_id}/file`
Download the completed file.

### GET `/api/v1/downloads/{session_id}/zip`
Download all completed files as ZIP.

### POST `/api/v1/metadata`
Preview metadata before queuing.
```json
{ "url": "https://youtube.com/watch?v=..." }
```

### WebSocket `/ws/progress/{session_id}`
Real-time progress stream. Messages:
```json
{ "type": "progress", "job_id": "...", "status": "downloading", "progress": 45.2 }
{ "type": "metadata", "job_id": "...", "title": "Song Title", "thumbnail_url": "..." }
{ "type": "ping" }
```

---

## Why yt-dlp (not youtube-dl)?

- **youtube-dl** hasn't been updated since December 2021 — YouTube's internal player changes broke it completely (the errors you saw: `Signature extraction failed`, `decodeURIComponent not found`)
- **yt-dlp** is an actively maintained fork, updated weekly, handles all YouTube changes
- We also auto-update yt-dlp daily via Celery Beat so it stays current

---

## Legal Disclaimer

This software is for **personal use only**. Do not download copyrighted content you don't have rights to. The developer is not responsible for misuse. Respect YouTube's Terms of Service.

---

## Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.111 + uvicorn + uvloop |
| Task Queue | Celery 5.4 + Redis 7 |
| Database | PostgreSQL 16 + SQLAlchemy 2 async |
| Download Engine | yt-dlp (latest) + ffmpeg |
| Frontend | Next.js 14 + React 18 + Zustand |
| Real-time | WebSockets + Redis Pub/Sub |
| Proxy | Nginx 1.25 |
| Monitoring | Prometheus + Grafana |
| CI/CD | GitHub Actions |
| Containers | Docker + Docker Compose |
