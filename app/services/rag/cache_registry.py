"""Persistent cache registry using Redis."""

from typing import Any, Optional, cast
from app.db.dependencies import get_redis_client


def get_cache_name(doc_name: str) -> Optional[str]:
    """Get cache name for a document from Redis."""
    try:
        client = get_redis_client()
        cache_name = cast(Any, client.get(f"gemini_cache:{doc_name}"))
        return cache_name.decode() if isinstance(cache_name, bytes) else cache_name
    except Exception as e:
        print(f"[CACHE] Error getting cache name: {e}")
        return None


def set_cache_name(doc_name: str, cache_name: str, ttl_seconds: int = 86400):
    """Set cache name for a document in Redis with TTL."""
    try:
        client = get_redis_client()
        client.setex(f"gemini_cache:{doc_name}", ttl_seconds, cache_name)
        print(f"[CACHE] Saved to Redis: {doc_name} -> {cache_name}")
    except Exception as e:
        print(f"[CACHE] Error setting cache name: {e}")


def delete_cache_name(doc_name: str) -> bool:
    """Delete cache name for a document from Redis."""
    try:
        client = get_redis_client()
        result = cast(int, client.delete(f"gemini_cache:{doc_name}"))
        return result > 0
    except Exception as e:
        print(f"[CACHE] Error deleting cache name: {e}")
        return False


def delete_cache_entries_for_document(doc_name: str) -> int:
    """Delete single-document and multi-document cache entries containing a document."""
    try:
        client = get_redis_client()
        keys = cast(list[Any], client.keys("gemini_cache:*"))
        keys_to_delete = []

        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            cache_key = key_str.replace("gemini_cache:", "", 1)
            cached_docs = cache_key.split("|")
            if doc_name in cached_docs:
                keys_to_delete.append(key)

        if not keys_to_delete:
            return 0

        return cast(int, client.delete(*keys_to_delete))
    except Exception as e:
        print(f"[CACHE] Error deleting cache entries for document: {e}")
        return 0


def list_all_cached_docs() -> dict:
    """List all cached documents from Redis."""
    try:
        client = get_redis_client()
        keys = cast(list[Any], client.keys("gemini_cache:*"))
        result = {}
        for key in keys:
            key_str = key.decode() if isinstance(key, bytes) else key
            doc_name = key_str.replace("gemini_cache:", "")
            cache_name = cast(Any, client.get(key))
            if cache_name:
                cache_name_str = cache_name.decode() if isinstance(cache_name, bytes) else cache_name
                result[doc_name] = cache_name_str
        return result
    except Exception as e:
        print(f"[CACHE] Error listing caches: {e}")
        return {}
