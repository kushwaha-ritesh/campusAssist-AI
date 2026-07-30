from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import connect_db, close_db
from app.routers import auth, requests, appointments, notifications, ai_chat, admin, campus_info


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await connect_db()
    except Exception as e:
        print(f"[WARNING] Could not connect to MongoDB: {e}")
        print("[WARNING] Register/login will fail until MongoDB is reachable.")
        print("[WARNING] Set MONGODB_URL in backend/.env to your Atlas connection string.")
    yield
    await close_db()


app = FastAPI(
    title="CampusAssist AI – API",
    description="Smart Student Help Desk backend powered by FastAPI and MongoDB.",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(requests.router)
app.include_router(appointments.router)
app.include_router(notifications.router)
app.include_router(ai_chat.router)
app.include_router(admin.router)
app.include_router(campus_info.router)


@app.get("/")
async def root():
    return {"message": "CampusAssist AI API is running", "docs": "/docs"}


@app.get("/health")
async def health():
    from app.database import client
    db_ok = False
    try:
        await client.admin.command("ping")
        db_ok = True
    except Exception:
        pass
    return {"status": "ok", "database": "connected" if db_ok else "disconnected"}
