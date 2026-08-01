from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # ── Try to decode the token ───────────────────────────────────────────────
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        student_id: str = payload.get("sub")
        role: str = payload.get("role")
        if student_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # ── DEV BYPASS: return in-memory user, skip MongoDB entirely ──────────────
    if settings.dev_bypass:
        from app.bypass import bypass_get_user
        user = bypass_get_user(student_id)
        if user is None:
            raise credentials_exception
        return user
    # ─────────────────────────────────────────────────────────────────────────

    from app.database import get_db
    from app.models.models import TokenData
    token_data = TokenData(student_id=student_id, role=role)
    db = get_db()
    user = await db.users.find_one({"student_id": token_data.student_id})
    if user is None:
        raise credentials_exception
    user["_id"] = str(user["_id"])
    return user


async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def require_admin(current_user: dict = Depends(get_current_active_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
