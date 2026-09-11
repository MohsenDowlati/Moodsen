import json
import logging
import os
import secrets
import threading
from contextlib import contextmanager
from typing import Iterator

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
NOTIFICATION_CACHE_TTL_SECONDS = int(
    os.getenv("NOTIFICATION_CACHE_TTL_SECONDS", "60")
)

_client = None


def get_redis():
    global _client
    if _client is None:
        from redis import Redis

        _client = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    return _client


def cache_get(key: str) -> dict | None:
    try:
        value = get_redis().get(key)
        return json.loads(value) if value else None
    except Exception:
        logger.warning("Redis cache read failed", exc_info=True)
        return None


def cache_set(key: str, value: dict) -> None:
    try:
        get_redis().setex(
            key,
            NOTIFICATION_CACHE_TTL_SECONDS,
            json.dumps(value, default=str),
        )
    except Exception:
        logger.warning("Redis cache write failed", exc_info=True)


def notification_cache_version(user_id: object) -> int:
    try:
        value = get_redis().get(f"notifications:{user_id}:version")
        return int(value or 0)
    except Exception:
        logger.warning("Redis cache version read failed", exc_info=True)
        return 0


def invalidate_notifications(user_id: object, event: str = "changed") -> None:
    try:
        client = get_redis()
        client.incr(f"notifications:{user_id}:version")
        client.publish(
            f"notifications:{user_id}",
            json.dumps({"event": event}),
        )
    except Exception:
        logger.warning("Redis notification invalidation failed", exc_info=True)


@contextmanager
def distributed_lock(
    name: str,
    ttl_seconds: int = 55,
) -> Iterator[bool]:
    token = secrets.token_hex(16)
    acquired = False
    locked_in_redis = False
    renewal_stopped = threading.Event()
    renewal_thread = None
    try:
        acquired = bool(get_redis().set(name, token, nx=True, ex=ttl_seconds))
        locked_in_redis = acquired
    except Exception:
        # Database uniqueness still protects notification correctness when
        # Redis is unavailable, so a single configured worker may continue.
        logger.warning("Redis lock unavailable; continuing without it", exc_info=True)
        acquired = True

    if locked_in_redis:
        def renew() -> None:
            while not renewal_stopped.wait(max(ttl_seconds // 3, 1)):
                try:
                    get_redis().eval(
                        "if redis.call('get', KEYS[1]) == ARGV[1] then "
                        "return redis.call('expire', KEYS[1], ARGV[2]) "
                        "else return 0 end",
                        1,
                        name,
                        token,
                        ttl_seconds,
                    )
                except Exception:
                    logger.warning("Redis lock renewal failed", exc_info=True)

        renewal_thread = threading.Thread(
            target=renew,
            name=f"redis-lock-renewal:{name}",
            daemon=True,
        )
        renewal_thread.start()

    try:
        yield acquired
    finally:
        renewal_stopped.set()
        if renewal_thread is not None:
            renewal_thread.join(timeout=1)
        if not acquired:
            return
        if not locked_in_redis:
            return
        try:
            get_redis().eval(
                "if redis.call('get', KEYS[1]) == ARGV[1] then "
                "return redis.call('del', KEYS[1]) else return 0 end",
                1,
                name,
                token,
            )
        except Exception:
            logger.warning("Redis lock release failed", exc_info=True)


async def notification_pubsub(user_id: object):
    from redis.asyncio import Redis

    client = Redis.from_url(REDIS_URL, decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(f"notifications:{user_id}")
    return client, pubsub
