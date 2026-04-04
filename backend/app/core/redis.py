import json
from typing import Any

import redis.asyncio as aioredis
from redis.asyncio import ConnectionPool

from app.core.config import settings

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=100,
            decode_responses=True,
        )
    return _pool


async def get_redis() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=get_pool())


class RedisCache:
    """High-level cache with JSON serialization."""

    def __init__(self, prefix: str = "melodex"):
        self.prefix = prefix

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    async def get(self, key: str) -> Any | None:
        r = await get_redis()
        val = await r.get(self._key(key))
        return json.loads(val) if val else None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> None:
        r = await get_redis()
        await r.setex(self._key(key), ttl, json.dumps(value, default=str))

    async def delete(self, key: str) -> None:
        r = await get_redis()
        await r.delete(self._key(key))

    async def publish(self, channel: str, message: dict) -> None:
        r = await get_redis()
        await r.publish(channel, json.dumps(message, default=str))

    async def increment(self, key: str, ttl: int = 60) -> int:
        r = await get_redis()
        pipe = r.pipeline()
        pipe.incr(self._key(key))
        pipe.expire(self._key(key), ttl)
        results = await pipe.execute()
        return results[0]


cache = RedisCache()
