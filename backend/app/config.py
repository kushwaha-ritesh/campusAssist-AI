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

    class Config:
        env_file = str(_ENV_FILE)


@lru_cache
def get_settings() -> Settings:
    return Settings()
