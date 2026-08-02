"""
otp.py — OTP generation, hashing, storage, rate-limiting, and verification.

Collection: otp_records
Document shape:
  {
    email:        str,
    purpose:      "register" | "reset_password",
    otp_hash:     str,          # bcrypt hash of the 6-digit code
    send_count:   int,          # resets after 24 h
    window_start: datetime UTC, # start of current 24-h window
    expires_at:   datetime UTC, # OTP valid until this time (10 min from last send)
    verified:     bool,         # True once correct code submitted
  }
"""
from __future__ import annotations

import random
import logging
from datetime import datetime, timedelta, UTC
from typing import Literal

from passlib.context import CryptContext

from app.database import get_db
from app.email_service import send_otp_email

log = logging.getLogger(__name__)

OTP_EXPIRE_MINUTES = 10
OTP_MAX_SENDS = 3
OTP_WINDOW_HOURS = 24

_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

Purpose = Literal["register", "reset_password"]


def _generate_otp() -> str:
    return str(random.randint(100000, 999999))


async def send_otp(email: str, purpose: Purpose) -> None:
    """
    Generate a new OTP, enforce rate limit, store hashed, and send email.
    Raises ValueError with a user-facing message on rate limit.
    """
    db = get_db()
    now = datetime.now(UTC)

    record = await db.otp_records.find_one({"email": email, "purpose": purpose})

    # ── Rate limit check ──────────────────────────────────────────────────────
    if record:
        window_start = record["window_start"]
        # Make window_start timezone-aware if stored naive
        if window_start.tzinfo is None:
            window_start = window_start.replace(tzinfo=UTC)

        window_age = now - window_start
        if window_age < timedelta(hours=OTP_WINDOW_HOURS):
            if record["send_count"] >= OTP_MAX_SENDS:
                raise ValueError(
                    "OTP limit reached. You can request a maximum of "
                    f"{OTP_MAX_SENDS} OTPs per 24 hours."
                )
            new_count = record["send_count"] + 1
            new_window_start = window_start   # keep existing window
        else:
            # Window expired — reset counter
            new_count = 1
            new_window_start = now
    else:
        new_count = 1
        new_window_start = now

    # ── Generate and hash OTP ─────────────────────────────────────────────────
    code = _generate_otp()
    otp_hash = _ctx.hash(code)
    expires_at = now + timedelta(minutes=OTP_EXPIRE_MINUTES)

    await db.otp_records.update_one(
        {"email": email, "purpose": purpose},
        {
            "$set": {
                "email": email,
                "purpose": purpose,
                "otp_hash": otp_hash,
                "send_count": new_count,
                "window_start": new_window_start,
                "expires_at": expires_at,
                "verified": False,
            }
        },
        upsert=True,
    )

    await send_otp_email(to_email=email, otp_code=code, purpose=purpose)
    log.info("OTP sent to %s (purpose=%s, attempt=%d)", email, purpose, new_count)


async def verify_otp(email: str, purpose: Purpose, code: str) -> None:
    """
    Verify the submitted OTP code.
    Marks verified=True on success.
    Raises ValueError with a user-facing message on any failure.
    """
    db = get_db()
    now = datetime.now(UTC)

    record = await db.otp_records.find_one({"email": email, "purpose": purpose})
    if not record:
        raise ValueError("No OTP was requested for this email. Please request a new code.")

    # Check expiry
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if now > expires_at:
        raise ValueError("OTP has expired. Please request a new one.")

    # Check already used
    if record.get("verified"):
        raise ValueError("This OTP has already been used. Please request a new one.")

    # Verify hash
    if not _ctx.verify(code, record["otp_hash"]):
        raise ValueError("Incorrect OTP. Please try again.")

    # Mark verified
    await db.otp_records.update_one(
        {"email": email, "purpose": purpose},
        {"$set": {"verified": True}},
    )


async def is_verified(email: str, purpose: Purpose) -> bool:
    """Return True if a verified (but not yet consumed) OTP exists for this email+purpose."""
    db = get_db()
    record = await db.otp_records.find_one({"email": email, "purpose": purpose})
    if not record:
        return False
    # Also check it hasn't expired since verification
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    now = datetime.now(UTC)
    return bool(record.get("verified")) and now <= expires_at


async def consume_otp(email: str, purpose: Purpose) -> None:
    """Delete the OTP record after successful use so it cannot be reused."""
    db = get_db()
    await db.otp_records.delete_one({"email": email, "purpose": purpose})


async def remaining_sends(email: str, purpose: Purpose) -> int:
    """Return how many OTP sends remain in the current 24-h window (for frontend display)."""
    db = get_db()
    now = datetime.now(UTC)
    record = await db.otp_records.find_one({"email": email, "purpose": purpose})
    if not record:
        return OTP_MAX_SENDS
    window_start = record["window_start"]
    if window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=UTC)
    if now - window_start >= timedelta(hours=OTP_WINDOW_HOURS):
        return OTP_MAX_SENDS
    return max(0, OTP_MAX_SENDS - record["send_count"])
