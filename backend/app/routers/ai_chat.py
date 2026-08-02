"""
AI Chat Router — Gemini RAG with live SSE streaming.

POST /api/ai/chat         — non-streaming fallback (returns full reply at once)
POST /api/ai/chat/stream  — SSE streaming (yields tokens as they arrive)
GET  /api/ai/sessions     — list past sessions for the current user
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.database import get_db
from app.models.models import ChatRequest, ChatMessage
from app.auth import get_current_active_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI Chatbot"])
settings = get_settings()

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are CampusAssist AI, a helpful and friendly university student help desk assistant.

STRICT RULES:
1. Answer ONLY using information provided in the CONTEXT section below.
2. If the answer is not in the context, say exactly:
   "I don't have specific information about that. Please contact the relevant office directly or raise a support request through the app."
3. Never make up office locations, phone numbers, fees, or dates.
4. Keep responses concise — 2 to 4 sentences unless a list is clearly better.
5. When relevant, mention the specific office name, block, room number, or phone number from the context.
6. You may suggest using app features (Raise Request, Book Appointment, Find Office) when appropriate.
7. Do not answer questions unrelated to university life, academics, or student services.
"""

# ── Gemini client ──────────────────────────────────────────────────────────────
_gemini_client = None

def _get_gemini():
    global _gemini_client
    if _gemini_client is None and settings.gemini_api_key:
        from google import genai
        _gemini_client = genai.Client(api_key=settings.gemini_api_key)
    return _gemini_client


# ── Rule-based fallback (no API key) ──────────────────────────────────────────
def _rule_based(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ["admission", "enroll", "register"]):
        return "For admission queries, please visit the Admissions Office (Block A, Room 101) or call +1-800-555-0101."
    if any(w in msg for w in ["fee", "payment", "tuition", "financial"]):
        return "Fee-related queries are handled by the Finance Office (Block B, Room 202). Phone: +1-800-555-0202."
    if any(w in msg for w in ["exam", "result", "grade", "transcript"]):
        return "For exam and result queries, contact the Examinations Department (Block C, Room 305)."
    if any(w in msg for w in ["appointment", "book", "schedule", "meet"]):
        return "You can book an appointment directly from the Dashboard → 'Book Appointment'."
    if any(w in msg for w in ["document", "certificate", "letter"]):
        return "Visit 'Required Documents' on the Dashboard for a full list of documents needed."
    if any(w in msg for w in ["office", "location", "where", "find"]):
        return "Use the 'Find Office' feature on the Dashboard to get office locations and contacts."
    if any(w in msg for w in ["hello", "hi", "hey"]):
        return "Hello! I'm CampusAssist AI. How can I help you today?"
    return (
        f'I understand you need help with: "{message}". '
        "For complex queries, please use 'Raise Request' to connect with a staff member."
    )


# ── Prompt builder ─────────────────────────────────────────────────────────────
def _build_prompt(message: str, history: list[dict], chunks: list[dict]) -> str:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[{i}] ({chunk.get('source', 'general')}) {chunk.get('title', '')}: {chunk.get('content', '')}"
        )
    context_text = "\n".join(context_parts) if context_parts else "No specific context found."

    # Last 10 turns of history (5 exchanges) to keep the prompt concise
    recent = history[-10:]
    history_text = ""
    for m in recent:
        role = "Student" if m.get("role") == "user" else "CampusAssist AI"
        history_text += f"{role}: {m.get('content', '')}\n"

    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"CONTEXT:\n{context_text}\n\n"
        f"CONVERSATION HISTORY:\n{history_text}\n"
        f"Student: {message}\n"
        f"CampusAssist AI:"
    )


# ── RAG response (non-streaming) ───────────────────────────────────────────────
async def generate_rag_response(message: str, history: list[dict]) -> str:
    client = _get_gemini()
    if not client:
        return _rule_based(message)

    from app.knowledge import search_chunks
    chunks = await search_chunks(message, top_k=5)
    prompt = _build_prompt(message, history, chunks)

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        return response.text.strip()
    except Exception as exc:
        log.error("Gemini generate_content failed: %s", exc)
        return _rule_based(message)


# ── Session persistence helper ─────────────────────────────────────────────────
async def _save_session(
    session_id: str, student_id: str, user_msg: dict, ai_msg: dict, history: list[dict]
) -> None:
    try:
        db = get_db()
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "session_id": session_id,
                "student_id": student_id,
                "messages": history,
                "updated_at": datetime.now(UTC),
            }},
            upsert=True,
        )
    except Exception as exc:
        log.warning("Failed to save chat session: %s", exc)


# ── Non-streaming endpoint ─────────────────────────────────────────────────────
@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_active_user),
):
    session_id = payload.session_id or str(uuid.uuid4())

    if settings.dev_bypass:
        ai_text = await generate_rag_response(payload.message, [])
        now = datetime.now(UTC).isoformat()
        return {
            "session_id": session_id,
            "reply": ai_text,
            "history": [
                {"role": "user", "content": payload.message, "timestamp": now},
                {"role": "assistant", "content": ai_text, "timestamp": now},
            ],
        }

    db = get_db()
    session = await db.chat_sessions.find_one({"session_id": session_id})
    history: list[dict] = session["messages"] if session else []

    user_msg = {"role": "user", "content": payload.message, "timestamp": datetime.now(UTC)}
    history.append(user_msg)

    ai_text = await generate_rag_response(payload.message, history)
    ai_msg = {"role": "assistant", "content": ai_text, "timestamp": datetime.now(UTC)}
    history.append(ai_msg)

    await _save_session(session_id, current_user["student_id"], user_msg, ai_msg, history)
    return {"session_id": session_id, "reply": ai_text, "history": history}


# ── Streaming endpoint (SSE) ───────────────────────────────────────────────────
@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Server-Sent Events endpoint. Yields tokens as:
        data: <token text>\n\n
    Ends with:
        data: [DONE]:<session_id>\n\n
    """
    session_id = payload.session_id or str(uuid.uuid4())
    student_id = current_user["student_id"]

    # Load history
    if settings.dev_bypass:
        history: list[dict] = []
    else:
        try:
            db = get_db()
            session = await db.chat_sessions.find_one({"session_id": session_id})
            history = session["messages"] if session else []
        except Exception:
            history = []

    user_msg = {"role": "user", "content": payload.message, "timestamp": datetime.now(UTC)}
    history.append(user_msg)

    client = _get_gemini()

    async def event_generator():
        full_reply = ""

        if not client:
            # Fallback: stream the rule-based reply word by word
            reply = _rule_based(payload.message)
            for word in reply.split():
                yield f"data: {word} \n\n"
                await asyncio.sleep(0.04)
        else:
            from app.knowledge import search_chunks
            chunks = await search_chunks(payload.message, top_k=5)
            prompt = _build_prompt(payload.message, history, chunks)
            try:
                stream = client.models.generate_content_stream(
                    model=settings.gemini_model,
                    contents=prompt,
                )
                for chunk in stream:
                    if chunk.text:
                        full_reply += chunk.text
                        # Escape newlines so SSE stays valid
                        safe = chunk.text.replace("\n", "\\n")
                        yield f"data: {safe}\n\n"
            except Exception as exc:
                log.error("Gemini stream failed: %s", exc)
                fallback = _rule_based(payload.message)
                full_reply = fallback
                for word in fallback.split():
                    yield f"data: {word} \n\n"
                    await asyncio.sleep(0.04)

        # Persist session
        ai_msg = {"role": "assistant", "content": full_reply, "timestamp": datetime.now(UTC)}
        history.append(ai_msg)
        if not settings.dev_bypass:
            await _save_session(session_id, student_id, user_msg, ai_msg, history)

        # Signal end with session_id so frontend can store it
        yield f"data: [DONE]:{session_id}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── List sessions ──────────────────────────────────────────────────────────────
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
