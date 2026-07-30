"""
AI Chat Router — stub for future AI integration.
Currently returns rule-based responses.
Replace the `generate_ai_response` function body with your LLM/Watson integration.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.models.models import ChatRequest, ChatSession, ChatMessage
from app.auth import get_current_active_user
from app.config import get_settings
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/ai", tags=["AI Chatbot"])
settings = get_settings()


# ─── Stub response generator ──────────────────────────────────────────────────
# TODO: Replace with IBM Watson Assistant / OpenAI / LangChain integration
async def generate_ai_response(message: str, history: list) -> str:
    msg = message.lower()
    if any(w in msg for w in ["admission", "enroll", "register"]):
        return "For admission queries, please visit the Admissions Office (Block A, Room 101) or call +1-800-CAMPUS. You can also raise a formal request via 'Raise Request'."
    if any(w in msg for w in ["fee", "payment", "tuition", "financial"]):
        return "Fee-related queries are handled by the Finance Office (Block B, Room 202). You can check your fee statement on the student portal."
    if any(w in msg for w in ["exam", "result", "grade", "transcript"]):
        return "For exam and result queries, contact the Examinations Department (Block C, Room 305). Transcripts take 5–7 working days."
    if any(w in msg for w in ["appointment", "book", "schedule", "meet"]):
        return "You can book an appointment directly from the Dashboard → 'Book Appointment'. Choose the office and preferred time slot."
    if any(w in msg for w in ["document", "certificate", "letter"]):
        return "Common required documents include: ID proof, enrollment letter, and fee receipts. Visit 'Required Documents' on the Dashboard for a full list."
    if any(w in msg for w in ["office", "location", "where", "find"]):
        return "Use the 'Find Office' feature on the Dashboard to get office locations, contact numbers, and working hours."
    if any(w in msg for w in ["hello", "hi", "hey", "good"]):
        return "Hello! I'm CampusAssist AI. How can I help you today? You can ask me about admissions, fees, exams, appointments, or office locations."
    return (
        f"I understand you need help with: \"{message}\". "
        "For complex queries, please use 'Raise Request' to connect with a staff member. "
        "You can also try asking about: admissions, fees, exams, appointments, or office locations."
    )


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_active_user),
):
    session_id = payload.session_id or str(uuid.uuid4())

    # In bypass mode, keep chat history in memory only (no MongoDB)
    if settings.dev_bypass:
        ai_text = await generate_ai_response(payload.message, [])
        return {
            "session_id": session_id,
            "reply": ai_text,
            "history": [
                {"role": "user", "content": payload.message, "timestamp": datetime.utcnow().isoformat()},
                {"role": "assistant", "content": ai_text, "timestamp": datetime.utcnow().isoformat()},
            ],
        }

    db = get_db()
    session = await db.chat_sessions.find_one({"session_id": session_id})
    history = session["messages"] if session else []

    user_msg = {"role": "user", "content": payload.message, "timestamp": datetime.utcnow()}
    history.append(user_msg)

    ai_text = await generate_ai_response(payload.message, history)
    ai_msg = {"role": "assistant", "content": ai_text, "timestamp": datetime.utcnow()}
    history.append(ai_msg)

    await db.chat_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "session_id": session_id,
            "student_id": current_user["student_id"],
            "messages": history,
        }},
        upsert=True,
    )

    return {"session_id": session_id, "reply": ai_text, "history": history}


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_active_user)):
    if settings.dev_bypass:
        return []
    db = get_db()
    cursor = db.chat_sessions.find(
        {"student_id": current_user["student_id"]}
    ).sort("_id", -1).limit(20)
    sessions = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        sessions.append(s)
    return sessions
