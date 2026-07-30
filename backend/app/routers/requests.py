from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from app.database import get_db
from app.models.models import RequestCreate, RequestUpdate, RequestInDB
from app.auth import get_current_active_user, require_admin
from app.config import get_settings
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/requests", tags=["Requests"])
settings = get_settings()


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/", response_model=RequestInDB, status_code=201)
async def create_request(
    payload: RequestCreate,
    current_user: dict = Depends(get_current_active_user),
):
    if settings.dev_bypass:
        raise HTTPException(
            status_code=503,
            detail="Raising requests requires MongoDB. Install MongoDB or connect Atlas to use this feature.",
        )
    db = get_db()
    now = datetime.utcnow()
    doc = {
        **payload.model_dump(),
        "student_id": current_user["student_id"],
        "student_name": current_user["full_name"],
        "status": "open",
        "admin_note": None,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.requests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/")
async def list_requests(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user),
):
    if settings.dev_bypass:
        return []
    db = get_db()
    query: dict = {}
    if current_user["role"] == "student":
        query["student_id"] = current_user["student_id"]
    if status:
        query["status"] = status
    cursor = db.requests.find(query).sort("created_at", -1)
    return [_serialize(r) async for r in cursor]


@router.get("/{request_id}")
async def get_request(
    request_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    if settings.dev_bypass:
        raise HTTPException(status_code=404, detail="No requests in bypass mode.")
    db = get_db()
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    doc = await db.requests.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")
    if current_user["role"] == "student" and doc["student_id"] != current_user["student_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return _serialize(doc)


@router.patch("/{request_id}")
async def update_request(
    request_id: str,
    payload: RequestUpdate,
    current_user: dict = Depends(require_admin),
):
    if settings.dev_bypass:
        raise HTTPException(status_code=503, detail="Requires MongoDB.")
    db = get_db()
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    result = await db.requests.find_one_and_update(
        {"_id": ObjectId(request_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return _serialize(result)


@router.delete("/{request_id}", status_code=204)
async def delete_request(request_id: str, current_user: dict = Depends(require_admin)):
    if settings.dev_bypass:
        return
    db = get_db()
    if not ObjectId.is_valid(request_id):
        raise HTTPException(status_code=400, detail="Invalid request ID")
    await db.requests.delete_one({"_id": ObjectId(request_id)})
