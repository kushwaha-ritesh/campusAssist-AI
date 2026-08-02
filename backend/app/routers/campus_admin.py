"""
Admin CRUD endpoints for managing offices and document categories.
All endpoints require admin role.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db
from app.auth import require_admin
from app.models.models import OfficeCreate, OfficeUpdate, DocumentCategoryCreate, DocumentCategoryUpdate

router = APIRouter(prefix="/api/admin/campus", tags=["Admin – Campus Info"])


# ── Offices ───────────────────────────────────────────────────────────────────

@router.get("/offices")
async def list_offices(_: dict = Depends(require_admin)):
    db = get_db()
    cursor = db.offices.find({}, {"_id": 0})
    return [doc async for doc in cursor]


@router.post("/offices", status_code=201)
async def create_office(payload: OfficeCreate, _: dict = Depends(require_admin)):
    db = get_db()
    existing = await db.offices.find_one({"id": payload.id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Office with id '{payload.id}' already exists")
    doc = payload.model_dump()
    await db.offices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/offices/{office_id}")
async def update_office(office_id: str, payload: OfficeUpdate, _: dict = Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.offices.update_one({"id": office_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Office not found")
    updated = await db.offices.find_one({"id": office_id}, {"_id": 0})
    return updated


@router.delete("/offices/{office_id}", status_code=204)
async def delete_office(office_id: str, _: dict = Depends(require_admin)):
    db = get_db()
    result = await db.offices.delete_one({"id": office_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Office not found")


# ── Document Categories ───────────────────────────────────────────────────────

@router.get("/documents")
async def list_documents(_: dict = Depends(require_admin)):
    db = get_db()
    cursor = db.documents.find({}, {"_id": 0})
    return [doc async for doc in cursor]


@router.post("/documents", status_code=201)
async def create_document_category(payload: DocumentCategoryCreate, _: dict = Depends(require_admin)):
    db = get_db()
    existing = await db.documents.find_one({"category": payload.category})
    if existing:
        raise HTTPException(status_code=400, detail=f"Category '{payload.category}' already exists")
    doc = payload.model_dump()
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/documents/{category}")
async def update_document_category(category: str, payload: DocumentCategoryUpdate, _: dict = Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.documents.update_one({"category": category}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document category not found")
    updated = await db.documents.find_one({"category": update_data.get("category", category)}, {"_id": 0})
    return updated


@router.delete("/documents/{category}", status_code=204)
async def delete_document_category(category: str, _: dict = Depends(require_admin)):
    db = get_db()
    result = await db.documents.delete_one({"category": category})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document category not found")
