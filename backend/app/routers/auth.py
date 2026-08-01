from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.models.models import UserCreate, UserResponse, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_active_user
from app.config import get_settings
from datetime import timedelta, datetime
import random
import string

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
settings = get_settings()


async def _generate_id(db, prefix: str) -> str:
    """Generate a unique sequential ID like STU2024001 or ADM2024001."""
    year = datetime.utcnow().year
    while True:
        suffix = ''.join(random.choices(string.digits, k=4))
        candidate = f"{prefix}{year}{suffix}"
        if not await db.users.find_one({"student_id": candidate}):
            return candidate


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user: UserCreate):
    # ── DEV BYPASS: registration not needed ────────────────────────────────
    if settings.dev_bypass:
        raise HTTPException(
            status_code=400,
            detail=(
                "DEV_BYPASS mode is ON — use the hardcoded accounts to log in. "
                "Student: STU001 / student123   Admin: ADMIN001 / admin123"
            ),
        )
    # ───────────────────────────────────────────────────────────────────────

    from app.database import get_db
    db = get_db()

    if user.role == "admin":
        if user.admin_code != settings.admin_registration_code:
            raise HTTPException(status_code=400, detail="Invalid admin registration code")

    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Auto-generate a unique ID
    prefix = "ADM" if user.role == "admin" else "STU"
    generated_id = await _generate_id(db, prefix)

    user_doc = {
        "student_id": generated_id,
        "full_name": user.full_name,
        "email": user.email,
        "department": user.department,
        "role": user.role,
        "hashed_password": hash_password(user.password),
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    return UserResponse(
        id=user_doc["_id"],
        student_id=user_doc["student_id"],
        full_name=user_doc["full_name"],
        email=user_doc["email"],
        department=user_doc.get("department"),
        role=user_doc["role"],
        is_active=user_doc["is_active"],
        created_at=user_doc["created_at"],
    )


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # ── DEV BYPASS: check in-memory accounts first ─────────────────────────
    if settings.dev_bypass:
        from app.bypass import bypass_login
        user = bypass_login(form_data.username, form_data.password)
        if user:
            token = create_access_token(
                data={"sub": user["student_id"], "role": user["role"]},
                expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
            )
            return Token(
                access_token=token,
                user=UserResponse(
                    id=user["_id"],
                    student_id=user["student_id"],
                    full_name=user["full_name"],
                    email=user["email"],
                    department=user.get("department"),
                    role=user["role"],
                    is_active=True,
                    created_at=user["created_at"],
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Bypass accounts: STU001/student123 or ADMIN001/admin123",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # ───────────────────────────────────────────────────────────────────────

    from app.database import get_db
    db = get_db()
    user = await db.users.find_one(
        {"$or": [{"student_id": form_data.username}, {"email": form_data.username}]}
    )
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid student ID / email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Account is inactive")

    token = create_access_token(
        data={"sub": user["student_id"], "role": user["role"]},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(
        access_token=token,
        user=UserResponse(
            id=str(user["_id"]),
            student_id=user["student_id"],
            full_name=user["full_name"],
            email=user["email"],
            department=user.get("department"),
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=user.get("created_at"),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_active_user)):
    return UserResponse(
        id=current_user.get("_id"),
        student_id=current_user["student_id"],
        full_name=current_user["full_name"],
        email=current_user["email"],
        department=current_user.get("department"),
        role=current_user["role"],
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at"),
    )
