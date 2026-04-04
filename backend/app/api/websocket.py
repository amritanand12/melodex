"""
WebSocket endpoint – real-time progress relay.
Subscribes to Redis pub/sub channel and forwards to browser clients.
Handles 10,000+ concurrent connections via asyncio.
"""
import asyncio
import json

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings

log = structlog.get_logger()
router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections per session."""

    def __init__(self):
        # session_id → set of WebSocket connections
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(session_id, set()).add(ws)
        log.info("ws.connected", session_id=session_id, total=self.total_connections)

    async def disconnect(self, session_id: str, ws: WebSocket):
        async with self._lock:
            conns = self._connections.get(session_id, set())
            conns.discard(ws)
            if not conns:
                self._connections.pop(session_id, None)
        log.info("ws.disconnected", session_id=session_id)

    async def broadcast(self, session_id: str, message: dict):
        conns = self._connections.get(session_id, set()).copy()
        dead = set()
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        # Prune dead connections
        if dead:
            async with self._lock:
                self._connections.get(session_id, set()).difference_update(dead)

    @property
    def total_connections(self) -> int:
        return sum(len(v) for v in self._connections.values())


manager = ConnectionManager()


@router.websocket("/progress/{session_id}")
async def websocket_progress(ws: WebSocket, session_id: str):
    """
    WebSocket endpoint that streams download progress to the client.
    Subscribes to a Redis channel keyed by session_id.
    """
    await manager.connect(session_id, ws)

    # Create a dedicated Redis pub/sub connection per WS
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_keepalive=True,
    )
    pubsub = redis_client.pubsub()
    channel = f"session:{session_id}"
    await pubsub.subscribe(channel)

    log.info("ws.subscribed", channel=channel, session_id=session_id)

    # Send initial heartbeat
    await ws.send_json({"type": "connected", "session_id": session_id})

    try:
        async def listen_redis():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        await manager.broadcast(session_id, data)
                    except json.JSONDecodeError:
                        pass

        async def heartbeat():
            while True:
                await asyncio.sleep(25)
                try:
                    await ws.send_json({"type": "ping"})
                except Exception:
                    break

        # Run both concurrently; cancel when WS disconnects
        await asyncio.gather(listen_redis(), heartbeat())

    except WebSocketDisconnect:
        log.info("ws.client_disconnected", session_id=session_id)
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        log.warning("ws.error", session_id=session_id, error=str(exc))
    finally:
        await pubsub.unsubscribe(channel)
        await redis_client.aclose()
        await manager.disconnect(session_id, ws)
