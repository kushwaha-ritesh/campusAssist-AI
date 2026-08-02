"""
crawler.py — Background web crawler for university website content.

Fetches notices, FAQs, timetables, and placement pages from the university website,
parses clean text, splits into chunks, and upserts into knowledge_chunks via knowledge.py.

The APScheduler job runs every `settings.crawl_interval_hours` hours.
Activate by setting UNIVERSITY_BASE_URL in backend/.env.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, UTC

import httpx
from bs4 import BeautifulSoup
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

# Sub-paths to crawl relative to university_base_url.
# Extend this list as needed for your university's site structure.
CRAWL_PATHS: list[tuple[str, str]] = [
    ("/notices",    "notice"),
    ("/faq",        "faq"),
    ("/timetable",  "timetable"),
    ("/placement",  "placement"),
    ("/circulars",  "circular"),
]

# ── HTML fetch ─────────────────────────────────────────────────────────────────

async def fetch_page(url: str) -> str:
    """Return the raw HTML of `url`, or empty string on any error."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "CampusAssistBot/1.0"})
            resp.raise_for_status()
            return resp.text
    except Exception as exc:
        log.warning("[crawler] fetch_page(%s) failed: %s", url, exc)
        return ""


# ── Text extraction + chunking ─────────────────────────────────────────────────

def extract_chunks(
    html: str,
    source_label: str,
    url: str,
    max_chars: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """
    Parse HTML, extract clean text blocks, split into overlapping chunks.
    Returns list of {source, title, content, url} dicts ready for upsert_chunk().
    """
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")

    # Remove boilerplate tags
    for tag in soup(["nav", "header", "footer", "script", "style", "noscript", "aside"]):
        tag.decompose()

    # Try to get a page title
    page_title = ""
    title_tag = soup.find("title")
    if title_tag:
        page_title = title_tag.get_text(strip=True)
    if not page_title:
        h1 = soup.find("h1")
        page_title = h1.get_text(strip=True) if h1 else source_label.capitalize()

    # Collect relevant text blocks
    blocks: list[str] = []
    for tag in soup.find_all(["h1", "h2", "h3", "p", "li"]):
        text = tag.get_text(separator=" ", strip=True)
        if len(text) > 30:          # skip trivially short fragments
            blocks.append(text)

    full_text = " ".join(blocks)
    if not full_text.strip():
        return []

    # Split into overlapping chunks
    chunks: list[dict] = []
    start = 0
    chunk_index = 0
    while start < len(full_text):
        end = start + max_chars
        chunk_text = full_text[start:end].strip()
        if chunk_text:
            chunks.append({
                "source": source_label,
                "title": f"{page_title} (part {chunk_index + 1})" if chunk_index > 0 else page_title,
                "content": chunk_text,
                "url": url,
            })
        start = end - overlap
        chunk_index += 1

    return chunks


# ── Main crawl job ─────────────────────────────────────────────────────────────

async def crawl_once() -> None:
    """Fetch all configured pages, extract chunks, upsert into knowledge_chunks."""
    from app.knowledge import upsert_chunk
    from app.database import get_db

    base = settings.university_base_url.rstrip("/")
    if not base:
        return

    db = get_db()
    total_chunks = 0
    errors = 0

    for path, label in CRAWL_PATHS:
        url = base + path
        log.info("[crawler] Crawling %s ...", url)
        html = await fetch_page(url)
        if not html:
            errors += 1
            continue

        chunks = extract_chunks(html, label, url)
        for chunk in chunks:
            await upsert_chunk(
                source=chunk["source"],
                title=chunk["title"],
                content=chunk["content"],
                url=chunk["url"],
            )
        total_chunks += len(chunks)
        log.info("[crawler] %s → %d chunks upserted", url, len(chunks))

    # Log crawl summary to MongoDB
    try:
        await db.crawl_log.insert_one({
            "crawled_at": datetime.now(UTC),
            "base_url": base,
            "total_chunks": total_chunks,
            "errors": errors,
        })
    except Exception as exc:
        log.warning("[crawler] Failed to write crawl_log: %s", exc)

    log.info("[crawler] Crawl complete — %d chunks, %d errors.", total_chunks, errors)


# ── APScheduler setup ──────────────────────────────────────────────────────────

_scheduler: AsyncIOScheduler | None = None


def start_crawler() -> None:
    """Register and start the background crawl scheduler."""
    global _scheduler
    if _scheduler is not None:
        return  # already started

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        crawl_once,
        trigger="interval",
        hours=settings.crawl_interval_hours,
        id="university_crawl",
        replace_existing=True,
        next_run_time=datetime.now(UTC),   # run immediately on startup, then every N hours
    )
    _scheduler.start()
    log.info(
        "[crawler] Scheduler started — crawling every %d hour(s).",
        settings.crawl_interval_hours,
    )
