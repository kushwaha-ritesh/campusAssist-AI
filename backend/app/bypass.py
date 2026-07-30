"""
DEV BYPASS — hardcoded in-memory users for testing without MongoDB.
Activated by setting  DEV_BYPASS=true  in backend/.env

REMOVE or set DEV_BYPASS=false before going to production.
"""
from datetime import datetime

# ── Hardcoded test accounts ────────────────────────────────────────────────────
# student  →  ID: STU001   password: student123
# admin    →  ID: ADMIN001 password: admin123
# ──────────────────────────────────────────────────────────────────────────────

BYPASS_USERS: dict[str, dict] = {
    "STU001": {
        "_id": "bypass-student-001",
        "student_id": "STU001",
        "full_name": "Demo Student",
        "email": "student@demo.edu",
        "department": "Computer Science",
        "role": "student",
        "hashed_password": "bypass",   # never checked — matched by plain text
        "plain_password": "student123",
        "is_active": True,
        "created_at": datetime.utcnow(),
    },
    "ADMIN001": {
        "_id": "bypass-admin-001",
        "student_id": "ADMIN001",
        "full_name": "Demo Admin",
        "email": "admin@demo.edu",
        "department": None,
        "role": "admin",
        "hashed_password": "bypass",
        "plain_password": "admin123",
        "is_active": True,
        "created_at": datetime.utcnow(),
    },
}


def bypass_login(student_id: str, password: str) -> dict | None:
    """Return user dict if credentials match a bypass account, else None."""
    user = BYPASS_USERS.get(student_id.upper())
    if user and user["plain_password"] == password:
        return user
    return None


def bypass_get_user(student_id: str) -> dict | None:
    """Lookup a bypass user by student_id (used by token validator)."""
    return BYPASS_USERS.get(student_id.upper())
