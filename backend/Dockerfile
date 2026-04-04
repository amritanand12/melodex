FROM python:3.12-slim AS base

# System deps: ffmpeg critical for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install yt-dlp from pip (kept up-to-date)
RUN pip install --no-cache-dir "yt-dlp>=2024.1.0" && \
    yt-dlp --version

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create downloads dir
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

FROM base AS production
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4", "--loop", "uvloop", "--http", "httptools", \
     "--access-log", "--log-level", "info"]
