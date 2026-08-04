"""
turnstile.py — Cloudflare Turnstile server-side verification.

Calls the Cloudflare siteverify endpoint to confirm the token issued by the
frontend widget is genuine.  When CLOUDFLARE_TURNSTILE_SECRET_KEY is not
configured (dev mode) the check is skipped with a warning log.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import HTTPException

from app.config import get_settings

log = logging.getLogger(__name__)

_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str | None) -> None:
    """
    Verify a Cloudflare Turnstile response token.

    Raises HTTPException(400) if verification fails.
    Is a no-op (with a dev warning) when the secret key is not configured.
    """
    settings = get_settings()
    secret = settings.cloudflare_turnstile_secret_key

    if not secret:
        log.warning(
            "[DEV] CLOUDFLARE_TURNSTILE_SECRET_KEY not set — skipping Turnstile verification."
        )
        return

    if not token:
        raise HTTPException(
            status_code=400,
            detail="Human verification token missing. Please complete the challenge.",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _SITEVERIFY_URL,
            data={"secret": secret, "response": token},
        )

    if resp.status_code != 200:
        log.error("Turnstile siteverify HTTP error: %s", resp.status_code)
        raise HTTPException(
            status_code=400,
            detail="Human verification failed. Please try again.",
        )

    result = resp.json()
    if not result.get("success"):
        error_codes = result.get("error-codes", [])
        log.warning("Turnstile verification failed: %s", error_codes)
        raise HTTPException(
            status_code=400,
            detail="Human verification failed. Please try again.",
        )
