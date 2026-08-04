from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve .env relative to this file so it works regardless of cwd
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "campusassist"
    secret_key: str = "change-me-to-a-long-random-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    admin_registration_code: str = "ADMIN2024"
    # Set to "true" to enable hardcoded bypass credentials (no MongoDB needed)
    dev_bypass: bool = False
    # Comma-separated allowed CORS origins
    # e.g. ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    # ── Gemini AI ─────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model: str = "models/gemini-2.0-flash-lite"
    gemini_embedding_model: str = "models/gemini-embedding-2"
    # ── Web Crawler ───────────────────────────────────────────────────────────
    # Base URL of your university website (leave empty to disable crawler)
    university_base_url: str = ""
    crawl_interval_hours: int = 6
    # ── Brevo Email ───────────────────────────────────────────────────────────
    brevo_api_key: str = ""
    brevo_sender_email: str = ""
    brevo_sender_name: str = "CampusAssist AI"
    # ── Cloudflare Turnstile ──────────────────────────────────────────────────
    cloudflare_turnstile_secret_key: str = ""

    class Config:
        env_file = str(_ENV_FILE)


@lru_cache
def get_settings() -> Settings:
    return Settings()
