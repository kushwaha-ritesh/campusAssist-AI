from fastapi import APIRouter
from app.routers.static_data import OFFICES, REQUIRED_DOCUMENTS

router = APIRouter(prefix="/api", tags=["Campus Info"])


@router.get("/offices")
async def get_offices():
    return OFFICES


@router.get("/documents")
async def get_required_documents():
    return REQUIRED_DOCUMENTS
