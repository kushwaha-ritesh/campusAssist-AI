"""
knowledge.py — RAG knowledge base operations.

Uses google-genai (v1+) SDK — the current supported package.

Owns all interactions with the `knowledge_chunks` MongoDB collection:
  - embed_text()       : call Gemini text-embedding-004
  - search_chunks()    : vector search (Atlas) with text-search fallback
  - upsert_chunk()     : embed + store/update a knowledge chunk
  - seed_static_data() : seed offices and required-documents on first startup
"""
from __future__ import annotations

import logging
from datetime import datetime, UTC
from typing import Any

from google import genai
from google.genai import types as genai_types

from app.config import get_settings
from app.database import get_db

log = logging.getLogger(__name__)
settings = get_settings()

# ── Gemini client (initialised once) ──────────────────────────────────────────
_client: genai.Client | None = None


def _get_client() -> genai.Client | None:
    global _client
    if _client is None and settings.gemini_api_key:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ── Embedding ──────────────────────────────────────────────────────────────────

async def embed_text(text: str) -> list[float] | None:
    """Return a 768-dim embedding vector, or None if the API key is not set."""
    client = _get_client()
    if not client:
        return None
    try:
        result = client.models.embed_content(
            model=settings.gemini_embedding_model,
            contents=text,
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        return result.embeddings[0].values
    except Exception as exc:
        log.warning("embed_text failed: %s", exc)
        return None


# ── Search ─────────────────────────────────────────────────────────────────────

async def search_chunks(query: str, top_k: int = 5) -> list[dict]:
    """
    Return up to top_k knowledge chunks relevant to `query`.

    Primary:  MongoDB Atlas $vectorSearch (requires the vector index to exist).
    Fallback: $text search (requires a text index on `content`).
    Last resort: return empty list.
    """
    if not settings.gemini_api_key:
        return []

    db = get_db()
    embedding = await embed_text(query)

    # ── Atlas Vector Search ──────────────────────────────────────────────────
    if embedding:
        try:
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "knowledge_embedding_index",
                        "path": "embedding",
                        "queryVector": embedding,
                        "numCandidates": top_k * 10,
                        "limit": top_k,
                    }
                },
                {"$project": {"_id": 0, "title": 1, "content": 1, "source": 1, "url": 1}},
            ]
            cursor = db.knowledge_chunks.aggregate(pipeline)
            results = [doc async for doc in cursor]
            if results:
                return results
        except Exception as exc:
            log.warning("Vector search failed, falling back to text search: %s", exc)

    # ── Text search fallback ─────────────────────────────────────────────────
    try:
        cursor = db.knowledge_chunks.find(
            {"$text": {"$search": query}},
            {"_id": 0, "title": 1, "content": 1, "source": 1, "url": 1},
        ).limit(top_k)
        return [doc async for doc in cursor]
    except Exception as exc:
        log.warning("Text search also failed: %s", exc)
        return []


# ── Upsert ─────────────────────────────────────────────────────────────────────

async def upsert_chunk(
    source: str, title: str, content: str, url: str | None = None
) -> None:
    """Embed content and insert-or-update the knowledge_chunks document."""
    if not settings.gemini_api_key:
        return
    db = get_db()
    embedding = await embed_text(content)
    doc: dict[str, Any] = {
        "source": source,
        "title": title,
        "content": content,
        "url": url,
        "crawled_at": datetime.now(UTC),
    }
    if embedding:
        doc["embedding"] = embedding
    await db.knowledge_chunks.update_one(
        {"source": source, "title": title},
        {"$set": doc},
        upsert=True,
    )


# ── Seed static data ───────────────────────────────────────────────────────────

async def seed_static_data() -> None:
    """
    Seed knowledge_chunks from the hardcoded offices and required-documents data.
    Runs on every startup but upserts are idempotent — safe to call repeatedly.
    """
    if not settings.gemini_api_key:
        log.info("[knowledge] GEMINI_API_KEY not set — skipping seed.")
        return

    from app.routers.static_data import OFFICES, REQUIRED_DOCUMENTS

    log.info("[knowledge] Seeding static office and document data...")

    for office in OFFICES:
        content = (
            f"{office['name']} is located at {office['block']}, {office['room']}. "
            f"Phone: {office['phone']}. Email: {office['email']}. "
            f"Hours: {office['hours']}. "
            f"Services offered: {', '.join(office['services'])}."
        )
        await upsert_chunk(
            source="office",
            title=office["name"],
            content=content,
        )

    for cat in REQUIRED_DOCUMENTS:
        content = (
            f"Required documents for {cat['category']}: "
            + "; ".join(cat["documents"]) + "."
        )
        await upsert_chunk(
            source="document",
            title=cat["category"],
            content=content,
        )

    log.info("[knowledge] Static seed complete.")
