import asyncio
import os
import pytest

# Override config for tests
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://melodex:test_pass@localhost:5432/melodex_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/1")
os.environ.setdefault("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci-only")
os.environ.setdefault("STORAGE_PATH", "/tmp/melodex_test")
os.environ.setdefault("ENVIRONMENT", "test")

import pathlib
pathlib.Path("/tmp/melodex_test").mkdir(exist_ok=True)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
