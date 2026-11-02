"""Rate limiting por IP, cuenta y acción.

En producción usa Redis con ventanas deslizantes. En desarrollo y tests usa
memoria del proceso, que es suficiente para una sola instancia. El arranque de
producción exige Redis (ver core/config.py).
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.config import get_settings

_memory: dict[str, deque[float]] = defaultdict(deque)
_lock = threading.Lock()
_redis_client = None


def _get_redis():  # type: ignore[no-untyped-def]
    """Crea el cliente Redis la primera vez que se necesita."""
    global _redis_client
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _redis_client is None:
        import redis

        _redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def client_ip(request: Request) -> str:
    """Obtiene la IP del cliente respetando proxies solo si está configurado."""
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


def enforce_rate_limit(
    request: Request,
    action: str,
    limit: int,
    window_seconds: int,
    extra: str = "",
) -> None:
    """Aplica una ventana deslizante y lanza 429 si se supera el límite.

    `extra` permite separar por identificador (por ejemplo, email de login)
    además de la IP. No se guarda el identificador en claro: se usa tal cual
    solo como parte de la clave de Redis, con TTL corto.
    """
    key = f"rl:{action}:{client_ip(request)}:{extra}".lower()
    now = time.time()
    client = _get_redis()

    if client is not None:
        pipe = client.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zcard(key)
        pipe.zadd(key, {f"{now}-{id(request)}": now})
        pipe.expire(key, window_seconds + 1)
        results = pipe.execute()
        count = int(results[1])
        if count >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "rate_limited",
                    "message": "Demasiados intentos. Esperá un momento y volvé a probar.",
                },
                headers={"Retry-After": str(window_seconds)},
            )
        return

    # Desarrollo/test: ventana deslizante en memoria.
    with _lock:
        bucket = _memory[key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "rate_limited",
                    "message": "Demasiados intentos. Esperá un momento y volvé a probar.",
                },
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)


def reset_rate_limits() -> None:
    """Limpia los contadores en memoria. Se usa en tests."""
    with _lock:
        _memory.clear()
