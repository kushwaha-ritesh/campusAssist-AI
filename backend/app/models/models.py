from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, schema):
        schema.update(type="string")
        return schema


# ─── User Models ────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    student_id: str
    full_name: str
    email: str
    department: Optional[str] = None
    role: Literal["student", "admin"] = "student"

class UserCreate(UserBase):
    password: str
    admin_code: Optional[str] = None

class UserInDB(UserBase):
    id: Optional[str] = Field(default=None, alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

    class Config:
        populate_by_name = True

class UserResponse(UserBase):
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


# ─── Token Models ───────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    student_id: Optional[str] = None
    role: Optional[str] = None


# ─── Request / Ticket Models ────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    title: str
    description: str
    category: Literal["academic", "financial", "technical", "administrative", "other"] = "other"
    priority: Literal["low", "medium", "high"] = "medium"

class RequestUpdate(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved", "closed"]] = None
    admin_note: Optional[str] = None

class RequestInDB(RequestCreate):
    id: Optional[str] = None
    student_id: str
    student_name: str
    status: Literal["open", "in_progress", "resolved", "closed"] = "open"
    admin_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Appointment Models ─────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    office: str
    purpose: str
    date: str          # ISO date string "YYYY-MM-DD"
    time_slot: str     # e.g. "10:00 AM"
    notes: Optional[str] = None

class AppointmentInDB(AppointmentCreate):
    id: Optional[str] = None
    student_id: str
    student_name: str
    status: Literal["pending", "confirmed", "cancelled"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── Notification Models ────────────────────────────────────────────────────────

class NotificationCreate(BaseModel):
    student_id: str       # use "all" for broadcast
    title: str
    message: str
    type: Literal["info", "warning", "success", "error"] = "info"

class NotificationInDB(NotificationCreate):
    id: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─── AI Chat Models (stub for future integration) ───────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatSession(BaseModel):
    session_id: str
    student_id: str
    messages: list[ChatMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
