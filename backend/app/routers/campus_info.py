from fastapi import APIRouter
from app.database import get_db

router = APIRouter(prefix="/api", tags=["Campus Info"])


# ── Student-facing read endpoints ─────────────────────────────────────────────

@router.get("/offices")
async def get_offices():
    db = get_db()
    cursor = db.offices.find({}, {"_id": 0})
    return [doc async for doc in cursor]


@router.get("/documents")
async def get_required_documents():
    db = get_db()
    cursor = db.documents.find({}, {"_id": 0})
    return [doc async for doc in cursor]


# ── Seed on first startup ──────────────────────────────────────────────────────

async def seed_campus_data() -> None:
    """Seed offices and documents from static_data.py if collections are empty."""
    from app.routers.static_data import OFFICES, REQUIRED_DOCUMENTS

    db = get_db()

    if await db.offices.count_documents({}) == 0:
        await db.offices.insert_many([dict(o) for o in OFFICES])
        print(f"[OK] Seeded {len(OFFICES)} offices into MongoDB")

    if await db.documents.count_documents({}) == 0:
        await db.documents.insert_many([dict(d) for d in REQUIRED_DOCUMENTS])
        print(f"[OK] Seeded {len(REQUIRED_DOCUMENTS)} document categories into MongoDB")
