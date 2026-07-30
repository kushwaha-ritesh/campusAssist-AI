from fastapi import APIRouter, Depends
from app.database import get_db
from app.auth import require_admin
from app.config import get_settings

router = APIRouter(prefix="/api/admin", tags=["Admin"])
settings = get_settings()


@router.get("/stats")
async def dashboard_stats(_: dict = Depends(require_admin)):
    if settings.dev_bypass:
        return {
            "total_students": 1,
            "open_requests": 0,
            "in_progress_requests": 0,
            "resolved_requests": 0,
            "total_appointments": 0,
            "pending_appointments": 0,
        }
    db = get_db()
    total_students = await db.users.count_documents({"role": "student"})
    open_requests = await db.requests.count_documents({"status": "open"})
    in_progress = await db.requests.count_documents({"status": "in_progress"})
    resolved = await db.requests.count_documents({"status": "resolved"})
    total_appointments = await db.appointments.count_documents({})
    pending_appointments = await db.appointments.count_documents({"status": "pending"})
    return {
        "total_students": total_students,
        "open_requests": open_requests,
        "in_progress_requests": in_progress,
        "resolved_requests": resolved,
        "total_appointments": total_appointments,
        "pending_appointments": pending_appointments,
    }


@router.get("/students")
async def list_students(_: dict = Depends(require_admin)):
    if settings.dev_bypass:
        return [
            {
                "_id": "bypass-student-001",
                "student_id": "STU001",
                "full_name": "Demo Student",
                "email": "student@demo.edu",
                "department": "Computer Science",
                "role": "student",
                "is_active": True,
                "created_at": None,
            }
        ]
    db = get_db()
    cursor = db.users.find({"role": "student"}, {"hashed_password": 0}).sort("created_at", -1)
    students = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        students.append(s)
    return students


@router.patch("/students/{student_id}/toggle-active")
async def toggle_student_active(student_id: str, _: dict = Depends(require_admin)):
    if settings.dev_bypass:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Requires MongoDB.")
    db = get_db()
    student = await db.users.find_one({"student_id": student_id})
    if not student:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Student not found")
    new_status = not student.get("is_active", True)
    await db.users.update_one(
        {"student_id": student_id}, {"$set": {"is_active": new_status}}
    )
    return {"student_id": student_id, "is_active": new_status}
