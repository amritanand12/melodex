#!/usr/bin/env bash
# ── Melodex Production Deploy ─────────────────────────────────────────────────
set -euo pipefail

echo "🚀 Melodex Production Deploy"
echo "────────────────────────────────────────"

if [ ! -f .env ]; then
  echo "❌ .env file not found. Copy .env.example and fill in values."
  exit 1
fi

if grep -q "CHANGE_THIS" .env; then
  echo "❌ You must set a proper SECRET_KEY in .env before deploying to production!"
  exit 1
fi

echo "🐳 Building Docker images..."
docker compose build --parallel

echo ""
echo "📦 Starting all services..."
docker compose up -d

echo ""
echo "⏳ Waiting for health checks..."
sleep 10

# Check backend health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/health || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Backend healthy"
else
  echo "⚠  Backend health check returned $HTTP_STATUS — check logs: docker compose logs backend"
fi

echo ""
echo "────────────────────────────────────────"
echo "✅ Melodex deployed!"
echo ""
echo "  App:       http://localhost"
echo "  API docs:  http://localhost/api/docs"
echo "  Flower:    http://localhost:5555"
echo "  Grafana:   http://localhost:3001  (admin/melodex_grafana)"
echo "  Prometheus:http://localhost:9090"
echo ""
echo "Scale workers: docker compose up -d --scale worker=10"
echo "View logs:     docker compose logs -f"
echo "────────────────────────────────────────"
