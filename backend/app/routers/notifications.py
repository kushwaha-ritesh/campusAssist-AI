from fastapi import APIRouter, Depends
from app.database import get_db
from app.models.models import NotificationCreate, NotificationInDB
from app.auth import get_current_active_user, require_admin
from app.config import get_settings
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])
settings = get_settings()


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_active_user)):
    if settings.dev_bypass:
        # Return a sample notification so the page isn't completely empty
        return [
            {
                "id": "bypass-notif-1",
                "student_id": current_user["student_id"],
                "title": "Welcome to CampusAssist AI",
                "message": "You are running in DEV BYPASS mode. Connect MongoDB to enable full functionality.",
                "type": "info",
                "is_read": False,
                "created_at": datetime.utcnow().isoformat(),
            }
        ]
    db = get_db()
    cursor = db.notifications.find({
        "$or": [
            {"student_id": current_user["student_id"]},
            {"student_id": "all"},
        ]
    }).sort("created_at", -1).limit(50)
    return [_serialize(n) async for n in cursor]


@router.post("/", response_model=NotificationInDB, status_code=201)
async def create_notification(
    payload: NotificationCreate, _: dict = Depends(require_admin)
):
    if settings.dev_bypass:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Requires MongoDB.")
    db = get_db()
    doc = {**payload.model_dump(), "is_read": False, "created_at": datetime.utcnow()}
    result = await db.notifications.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_active_user)):
    if settings.dev_bypass:
        return {"ok": True}
    db = get_db()
    if not ObjectId.is_valid(notif_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid ID")
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id)}, {"$set": {"is_read": True}}
    )
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_active_user)):
    if settings.dev_bypass:
        return {"ok": True}
    db = get_db()
    await db.notifications.update_many(
        {"$or": [{"student_id": current_user["student_id"]}, {"student_id": "all"}]},
        {"$set": {"is_read": True}},
    )
    return {"ok": True}
