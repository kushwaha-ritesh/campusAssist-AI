from fastapi import APIRouter, HTTPException, Depends
from app.database import get_db
from app.models.models import AppointmentCreate, AppointmentInDB
from app.auth import get_current_active_user, require_admin
from app.config import get_settings
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])
settings = get_settings()


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/", response_model=AppointmentInDB, status_code=201)
async def book_appointment(
    payload: AppointmentCreate,
    current_user: dict = Depends(get_current_active_user),
):
    if settings.dev_bypass:
        raise HTTPException(
            status_code=503,
            detail="Appointments require MongoDB. Install MongoDB or connect Atlas to use this feature.",
        )
    db = get_db()
    doc = {
        **payload.model_dump(),
        "student_id": current_user["student_id"],
        "student_name": current_user["full_name"],
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.appointments.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/")
async def list_appointments(current_user: dict = Depends(get_current_active_user)):
    if settings.dev_bypass:
        return []
    db = get_db()
    query = (
        {}
        if current_user["role"] == "admin"
        else {"student_id": current_user["student_id"]}
    )
    cursor = db.appointments.find(query).sort("created_at", -1)
    return [_serialize(a) async for a in cursor]


@router.patch("/{appt_id}/status")
async def update_appointment_status(
    appt_id: str,
    status: str,
    current_user: dict = Depends(require_admin),
):
    if settings.dev_bypass:
        raise HTTPException(status_code=503, detail="Requires MongoDB.")
    db = get_db()
    if not ObjectId.is_valid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID")
    if status not in ("pending", "confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status value")
    result = await db.appointments.find_one_and_update(
        {"_id": ObjectId(appt_id)},
        {"$set": {"status": status}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return _serialize(result)


@router.delete("/{appt_id}", status_code=204)
async def cancel_appointment(
    appt_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    if settings.dev_bypass:
        return
    db = get_db()
    if not ObjectId.is_valid(appt_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID")
    doc = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user["role"] == "student" and doc["student_id"] != current_user["student_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    await db.appointments.delete_one({"_id": ObjectId(appt_id)})
