"""
email_service.py — Sends transactional OTP emails via Brevo REST API.

Falls back to console log if BREVO_API_KEY is not set (dev mode).
"""
from __future__ import annotations

import logging
import httpx

from app.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _otp_html(otp_code: str, purpose: str) -> str:
    action = "complete your registration" if purpose == "register" else "reset your password"
    return f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0f62fe;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:1.25rem;font-weight:600;">
              CampusAssist AI
            </h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:0.875rem;">
              Smart Student Help Desk
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#1f2328;font-size:0.9rem;line-height:1.6;">
              Use the verification code below to {action}.
              This code expires in <strong>10 minutes</strong>.
            </p>
            <!-- OTP box -->
            <div style="text-align:center;margin:24px 0;">
              <div style="display:inline-block;background:#f0f4ff;border:2px solid #0f62fe;
                          border-radius:8px;padding:16px 40px;">
                <span style="font-size:2.5rem;font-weight:700;letter-spacing:0.3em;
                             color:#0f62fe;font-family:monospace;">
                  {otp_code}
                </span>
              </div>
            </div>
            <p style="margin:16px 0 0;color:#57606a;font-size:0.8rem;line-height:1.6;">
              If you did not request this code, please ignore this email.
              Do not share this code with anyone.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f7f8fa;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#57606a;font-size:0.75rem;">
              &copy; CampusAssist AI &mdash; Smart Student Help Desk
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_otp_email(to_email: str, otp_code: str, purpose: str) -> None:
    """Send OTP email via Brevo. Logs to console if API key is not configured."""
    subject = "Your CampusAssist AI Verification Code"

    if not settings.brevo_api_key:
        log.warning(
            "[DEV] Brevo API key not set. OTP for %s (%s): %s",
            to_email, purpose, otp_code,
        )
        print(f"\n[DEV EMAIL] To: {to_email} | Purpose: {purpose} | OTP: {otp_code}\n")
        return

    payload = {
        "sender": {
            "name": settings.brevo_sender_name,
            "email": settings.brevo_sender_email,
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": _otp_html(otp_code, purpose),
    }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            BREVO_URL,
            json=payload,
            headers={
                "api-key": settings.brevo_api_key,
                "Content-Type": "application/json",
            },
        )
        if resp.status_code not in (200, 201):
            log.error("Brevo send failed: %s %s", resp.status_code, resp.text)
            raise RuntimeError(f"Failed to send email: {resp.status_code}")
        log.info("OTP email sent to %s (purpose=%s)", to_email, purpose)
