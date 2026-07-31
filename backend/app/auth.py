from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False → missing/invalid token returns None instead of 401
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    from app.bypass import bypass_get_user, BYPASS_USERS

    # ── No token at all → return default bypass student (no auth required) ───
    if token is None:
        return list(BYPASS_USERS.values())[0]

    # ── Try to decode the token ───────────────────────────────────────────────
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        student_id: str = payload.get("sub")
        role: str = payload.get("role")
        if student_id is None:
            return list(BYPASS_USERS.values())[0]
    except JWTError:
        return list(BYPASS_USERS.values())[0]

    # ── DEV BYPASS: return in-memory user, skip MongoDB entirely ──────────────
    if settings.dev_bypass:
        user = bypass_get_user(student_id)
        return user if user else list(BYPASS_USERS.values())[0]
    # ─────────────────────────────────────────────────────────────────────────

    from app.database import get_db
    from app.models.models import TokenData
    token_data = TokenData(student_id=student_id, role=role)
    db = get_db()
    user = await db.users.find_one({"student_id": token_data.student_id})
    if user is None:
        return list(BYPASS_USERS.values())[0]
    user["_id"] = str(user["_id"])
    return user


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def require_admin(current_user: dict = Depends(get_current_active_user)):
    # Authentication removed — always pass through as admin in bypass/no-auth mode
    return current_user
