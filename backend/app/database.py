from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import HTTPException, status
from app.config import get_settings

settings = get_settings()

client: AsyncIOMotorClient = None


async def connect_db():
    global client
    client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000,   # fail fast instead of hanging
        connectTimeoutMS=5000,
    )
    # Ping to verify the connection is actually reachable
    await client.admin.command("ping")
    print(f"[OK] Connected to MongoDB at {settings.mongodb_url}")


async def close_db():
    global client
    if client:
        client.close()
        print("[OK] MongoDB connection closed")


def get_db():
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not connected. Check MONGODB_URL in backend/.env and ensure MongoDB is reachable.",
        )
    return client[settings.database_name]
