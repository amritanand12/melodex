#!/usr/bin/env bash
# ── Melodex Dev Setup Script ─────────────────────────────────────────────────
set -euo pipefail

echo "🎵 Melodex — Setup"
echo "────────────────────────────────────────"

# Check deps
command -v docker   >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v python3  >/dev/null 2>&1 || { echo "❌ Python 3.12+ required"; exit 1; }

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env from template"
  echo "   Edit .env to set SECRET_KEY before production deploy!"
fi

# Start all services
echo ""
echo "🐳 Starting services..."
docker compose up -d postgres redis

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Backend (dev mode, local)
echo ""
echo "🔧 Installing backend dependencies..."
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -q -r requirements.txt
pip install -q "yt-dlp>=2024.1.0"

echo ""
echo "🗄  Running database migrations..."
python -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
print('✅ Database initialized')
"

echo ""
echo "🚀 Starting backend API (port 8000)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo ""
echo "⚙  Starting Celery worker..."
celery -A app.workers.celery_app worker --loglevel=info --concurrency=2 &
WORKER_PID=$!

cd ..

# Frontend
echo ""
echo "🎨 Installing frontend dependencies..."
cd frontend
npm install --silent

echo ""
echo "🌐 Starting frontend (port 3000)..."
npm run dev &
FRONTEND_PID=$!

cd ..

echo ""
echo "────────────────────────────────────────"
echo "✅ Melodex is running!"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  API docs:  http://localhost:8000/api/docs"
echo "  Flower:    http://localhost:5555"
echo ""
echo "Press Ctrl+C to stop all services"
echo "────────────────────────────────────────"

trap "kill $BACKEND_PID $WORKER_PID $FRONTEND_PID 2>/dev/null; docker compose stop" EXIT
wait
