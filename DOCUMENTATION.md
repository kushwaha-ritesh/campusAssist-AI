# CampusAssist AI — Project Documentation

> Smart Student Help Desk — Full-stack university web application

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [API Reference](#5-api-reference)
6. [Data Models](#6-data-models)
7. [Authentication Flow](#7-authentication-flow)
8. [Environment Variables](#8-environment-variables)
9. [Local Development Setup](#9-local-development-setup)
10. [Deployment](#10-deployment)
11. [Dev Bypass Mode](#11-dev-bypass-mode)
12. [Extending the AI Chatbot](#12-extending-the-ai-chatbot)

---

## 1. Overview

**CampusAssist AI** is a production-ready, full-stack web application for managing student services at a university. Students submit support tickets, book appointments with campus offices, chat with an AI assistant, and receive notifications. Admins manage all of that from a dedicated dashboard.

### Student Features
| Feature | Description |
|---|---|
| **Ask AI** | Conversational chatbot with rule-based responses (LLM-ready stub) |
| **Find Office** | Searchable office directory with location, contacts & services |
| **Required Documents** | Categorised checklist of documents needed for various processes |
| **Raise Request** | Submit support tickets with category and priority |
| **Track Request** | Monitor ticket status and admin notes in real time |
| **Book Appointment** | Schedule meetings with any university office |
| **Notifications** | Read personal and broadcast notifications |

### Admin Features
| Feature | Description |
|---|---|
| **Dashboard** | Live stats — students, open requests, appointments |
| **Manage Requests** | Update ticket status and add admin notes |
| **Manage Appointments** | Confirm or cancel booked appointments |
| **Manage Students** | View all students, activate/deactivate accounts |
| **Send Notifications** | Broadcast messages or target specific students |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Zustand, React Router v6, Axios, Lucide Icons |
| **Backend** | Python 3.12, FastAPI, Uvicorn, Motor (async MongoDB driver) |
| **Database** | MongoDB (Atlas in production, local in dev) |
| **Auth** | JWT via `python-jose`, password hashing via `passlib[bcrypt]` |
| **Validation** | Pydantic v2 + pydantic-settings |
| **Containerisation** | Docker + Docker Compose |
| **Hosting** | Render (backend) + Vercel (frontend) |

---

## 3. Architecture

```
Browser
  │
  ▼
Frontend (React + Vite)          hosted on Vercel
  │  Axios HTTP/JSON
  ▼
Backend (FastAPI + Uvicorn)      hosted on Render
  │  Motor async driver
  ▼
MongoDB Atlas                    cloud database
```

**Request lifecycle:**
1. Browser sends an HTTP request to the Vercel frontend.
2. Axios attaches the JWT from `localStorage` and calls the Render backend.
3. FastAPI validates the JWT, runs business logic, and queries MongoDB via Motor.
4. JSON response returns to the frontend; Zustand state is updated; React re-renders.

---

## 4. Project Structure

```
campusassist/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point, CORS, lifespan, routers
│   │   ├── config.py            # All settings via pydantic-settings (.env)
│   │   ├── database.py          # Motor async MongoDB client
│   │   ├── auth.py              # JWT helpers, bcrypt, FastAPI dependencies
│   │   ├── bypass.py            # In-memory dev accounts (no MongoDB needed)
│   │   ├── models/
│   │   │   └── models.py        # All Pydantic request/response models
│   │   └── routers/
│   │       ├── auth.py          # /api/auth/*
│   │       ├── requests.py      # /api/requests/*
│   │       ├── appointments.py  # /api/appointments/*
│   │       ├── notifications.py # /api/notifications/*
│   │       ├── ai_chat.py       # /api/ai/* (rule-based stub, LLM-ready)
│   │       ├── admin.py         # /api/admin/*
│   │       ├── campus_info.py   # /api/offices, /api/documents
│   │       └── static_data.py   # Hardcoded office & document data
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── App.tsx              # All routes (student + admin)
│       ├── index.css            # IBM Carbon-inspired design system
│       ├── api/
│       │   ├── client.ts        # Axios instance + auth interceptor
│       │   └── endpoints.ts     # All API call functions
│       ├── store/
│       │   └── authStore.ts     # Zustand global auth state
│       ├── types/index.ts       # TypeScript interfaces
│       ├── components/layout/   # AppLayout, Sidebar, Topbar
│       └── pages/
│           ├── auth/            # LoginPage, RegisterPage
│           ├── student/         # 7 student pages
│           └── admin/           # 5 admin pages
│
├── docker-compose.yml
├── README.md
└── DOCUMENTATION.md             # ← this file
```

---

## 5. API Reference

### Base URLs
| Environment | URL |
|---|---|
| Local | `http://localhost:8000` |
| Production | `https://https://campusassist-ai-lml1.onrender.com` |
| Interactive docs (Swagger) | `<base-url>/docs` |
| ReDoc | `<base-url>/redoc` |

All protected endpoints require an `Authorization: Bearer <token>` header.

---

### 5.1 Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register a new student or admin |
| `POST` | `/api/auth/login` | None | Login — returns JWT + user object |
| `GET` | `/api/auth/me` | Bearer | Get currently logged-in user profile |

**Register — request body (JSON):**
```json
{
  "student_id": "STU001",
  "full_name": "Jane Doe",
  "email": "jane@uni.edu",
  "department": "Computer Science",
  "role": "student",
  "password": "secret123",
  "admin_code": null
}
```
> Admin registration requires `"role": "admin"` and the correct `admin_code` from your `.env`.

**Login — request body (`application/x-www-form-urlencoded`):**
```
username=STU001&password=secret123
```

**Login — response:**
```json
{
  "access_token": "<JWT>",
  "token_type": "bearer",
  "user": {
    "student_id": "STU001",
    "full_name": "Jane Doe",
    "email": "jane@uni.edu",
    "role": "student",
    "is_active": true
  }
}
```

---

### 5.2 Support Requests — `/api/requests`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/requests/` | Bearer | Student | Submit a new support ticket |
| `GET` | `/api/requests/` | Bearer | Both | List tickets (students see own only) |
| `GET` | `/api/requests/{id}` | Bearer | Both | Get a single ticket |
| `PATCH` | `/api/requests/{id}` | Bearer | Admin | Update status / add admin note |
| `DELETE` | `/api/requests/{id}` | Bearer | Admin | Delete a ticket |

**Categories:** `academic` · `financial` · `technical` · `administrative` · `other`

**Statuses:** `open` → `in_progress` → `resolved` → `closed`

**Priority levels:** `low` · `medium` · `high`

**Create request body:**
```json
{
  "title": "Fee receipt not received",
  "description": "I paid my semester fee but haven't received a receipt.",
  "category": "financial",
  "priority": "high"
}
```

**Update request body (admin only):**
```json
{
  "status": "in_progress",
  "admin_note": "Forwarded to the Finance Office."
}
```

---

### 5.3 Appointments — `/api/appointments`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/appointments/` | Bearer | Student | Book a new appointment |
| `GET` | `/api/appointments/` | Bearer | Both | List appointments |
| `PATCH` | `/api/appointments/{id}/status` | Bearer | Admin | Confirm or cancel |
| `DELETE` | `/api/appointments/{id}` | Bearer | Both | Cancel/delete an appointment |

**Statuses:** `pending` · `confirmed` · `cancelled`

**Book appointment body:**
```json
{
  "office": "Admissions Office",
  "purpose": "Enrollment verification",
  "date": "2025-08-15",
  "time_slot": "10:00 AM",
  "notes": "Bring original ID"
}
```

---

### 5.4 Notifications — `/api/notifications`

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/notifications/` | Bearer | Both | Get notifications for current user |
| `POST` | `/api/notifications/` | Bearer | Admin | Send notification (`"all"` = broadcast) |
| `PATCH` | `/api/notifications/{id}/read` | Bearer | Both | Mark one notification as read |
| `PATCH` | `/api/notifications/read-all` | Bearer | Both | Mark all notifications as read |

**Create notification body:**
```json
{
  "student_id": "all",
  "title": "Exam Schedule Released",
  "message": "The final exam schedule is now available on the portal.",
  "type": "info"
}
```
> **Types:** `info` · `warning` · `success` · `error`  
> Use `"student_id": "all"` to broadcast to every user.

---

### 5.5 AI Chatbot — `/api/ai`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/chat` | Bearer | Send a message, receive an AI reply |
| `GET` | `/api/ai/sessions` | Bearer | List past chat sessions (last 20) |

**Chat request body:**
```json
{
  "message": "How do I pay my tuition fees?",
  "session_id": null
}
```
> Pass `session_id` from a previous response to continue a conversation.

**Chat response:**
```json
{
  "session_id": "uuid-...",
  "reply": "Fee-related queries are handled by the Finance Office...",
  "history": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

---

### 5.6 Admin — `/api/admin`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Bearer (Admin) | Dashboard counters |
| `GET` | `/api/admin/students` | Bearer (Admin) | List all registered students |
| `PATCH` | `/api/admin/students/{student_id}/toggle-active` | Bearer (Admin) | Activate or deactivate a student account |

**Stats response:**
```json
{
  "total_students": 42,
  "open_requests": 5,
  "in_progress_requests": 3,
  "resolved_requests": 30,
  "total_appointments": 18,
  "pending_appointments": 4
}
```

---

### 5.7 Campus Info — `/api`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/offices` | None | List all campus offices with contacts |
| `GET` | `/api/documents` | None | List all required documents by category |

---

### 5.8 Health & Root

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Confirms the API is running |
| `GET` | `/health` | Returns `{ status, database }` — use as Render health-check path |

---

## 6. Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `student_id` | string | Primary key / login username |
| `full_name` | string | |
| `email` | string | Unique |
| `department` | string | Optional |
| `role` | `student` \| `admin` | |
| `hashed_password` | string | bcrypt hash |
| `is_active` | bool | Default `true` |
| `created_at` | datetime | |

### Request (Support Ticket)
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | MongoDB ID |
| `student_id` | string | FK → User |
| `student_name` | string | Denormalised |
| `title` | string | |
| `description` | string | |
| `category` | enum | academic / financial / technical / administrative / other |
| `priority` | enum | low / medium / high |
| `status` | enum | open / in_progress / resolved / closed |
| `admin_note` | string | Optional |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### Appointment
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | MongoDB ID |
| `student_id` | string | FK → User |
| `student_name` | string | Denormalised |
| `office` | string | |
| `purpose` | string | |
| `date` | string | ISO format `YYYY-MM-DD` |
| `time_slot` | string | e.g. `10:00 AM` |
| `notes` | string | Optional |
| `status` | enum | pending / confirmed / cancelled |
| `created_at` | datetime | |

### Notification
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | MongoDB ID |
| `student_id` | string | FK → User, or `"all"` for broadcast |
| `title` | string | |
| `message` | string | |
| `type` | enum | info / warning / success / error |
| `is_read` | bool | Default `false` |
| `created_at` | datetime | |

### ChatSession
| Field | Type | Notes |
|---|---|---|
| `session_id` | string | UUID |
| `student_id` | string | FK → User |
| `messages` | array | `[{ role, content, timestamp }]` |
| `created_at` | datetime | |

---

## 7. Authentication Flow

```
1. User submits student_id + password on LoginPage
2. Frontend POSTs to /api/auth/login (form-urlencoded)
3. Backend:
   a. Looks up user in MongoDB by student_id
   b. Verifies password with bcrypt
   c. Creates a signed JWT (HS256) with { sub: student_id, role, exp }
   d. Returns { access_token, token_type, user }
4. Frontend:
   a. Saves token to localStorage ("ca_token")
   b. Updates Zustand authStore with user object
   c. Redirects to /dashboard
5. Every subsequent API call:
   a. Axios request interceptor reads "ca_token" from localStorage
   b. Attaches "Authorization: Bearer <token>" header automatically
6. Token expiry (default 60 min):
   a. Backend returns 401
   b. User is redirected to /login
```

---

## 8. Environment Variables

All variables are read by `backend/app/config.py` via `pydantic-settings`. Copy `.env.example` to `.env` to get started.

| Variable | Default | Required in Prod | Description |
|---|---|---|---|
| `MONGODB_URL` | `mongodb+srv://ask-dev` | ✅ | Full MongoDB Atlas connection string |
| `DATABASE_NAME` | `myVirtualDatabase` | Optional | MongoDB database name |
| `SECRET_KEY` | `ask-dev` | ✅ | JWT signing secret — use a 64-char random string |
| `ALGORITHM` | `HS256` | Optional | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Optional | Token lifespan in minutes |
| `ADMIN_REGISTRATION_CODE` | `ask_dev` | ✅ | Code required to register as admin |
| `DEV_BYPASS` | `false` | ✅ must be `false` | Enables in-memory dev accounts — **never `true` in production** |

**Generate a secure `SECRET_KEY`:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 9. Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- MongoDB running locally **or** a free MongoDB Atlas cluster

### Backend
```bash
cd backend
cp .env.example .env           # edit MONGODB_URL and SECRET_KEY
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API available at: http://localhost:8000  
Swagger UI at: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### Docker Compose (all-in-one)
```bash
docker-compose up --build      # Frontend: http://localhost:3000
```

---

## 10. Deployment

### Backend → Render

| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Runtime** | Docker (uses `backend/Dockerfile`) |
| **Exposed Port** | `8000` |
| **Health Check Path** | `/health` |
| **Start Command** (non-Docker) | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |

**Required environment variables on Render:**
```
MONGODB_URL              = mongodb+srv://<user>:<pass>@cluster.mongodb.net/myVirtualDatabase
DATABASE_NAME            = campusassist
SECRET_KEY               = <64-char random hex string>
ALGORITHM                = HS256
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ADMIN_REGISTRATION_CODE  = <your-secret-admin-code>
DEV_BYPASS               = false
```

### Frontend → Vercel

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

**Required environment variable on Vercel:**
```
VITE_API_BASE_URL = https://campusassist-ai-lml1.onrender.com/
```

### ⚠️ CORS — Required Before Deploying

The current `main.py` only allows `localhost` origins. Before deploying, add your Vercel URL to `allow_origins` in `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://.vercel.app",   # ← add this
    ],
    ...
)
```

---

## 11. Dev Bypass Mode

The app ships with a zero-MongoDB development mode controlled by `DEV_BYPASS=true` in `.env`. When enabled:

- Registration is disabled.
- Two hardcoded in-memory accounts are available:

| Role | Student ID | Password |
|---|---|---|
| Student | `STU001` | `student123` |
| Admin | `ADMIN001` | `admin123` |

- All data (requests, appointments) is stored in-memory and lost on restart.
- Chat history is not persisted.
- **Never enable `DEV_BYPASS` in production.**

---

## 12. Extending the AI Chatbot

The chatbot lives in `backend/app/routers/ai_chat.py`. The stub function is clearly marked for replacement:

```python
async def generate_ai_response(message: str, history: list) -> str:
    # TODO: Replace with your LLM integration
    # Examples:
    #
    # OpenAI:
    #   from openai import AsyncOpenAI
    #   client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    #   response = await client.chat.completions.create(
    #       model="gpt-4o",
    #       messages=[{"role": m["role"], "content": m["content"]} for m in history]
    #   )
    #   return response.choices[0].message.content
    #
    # IBM Watson Assistant:
    #   from ibm_watson import AssistantV2
    #   ...
    #
    # LangChain:
    #   from langchain.chains import ConversationChain
    #   ...
```

**Steps to add a real LLM:**
1. Add the SDK to `backend/requirements.txt` (e.g. `openai>=1.0`)
2. Add the API key to `.env` and Render's environment variables (e.g. `OPENAI_API_KEY`)
3. Add the key to `config.py` as a new `Settings` field
4. Replace the body of `generate_ai_response()` — the rest of the router (session persistence, history passing) is already wired up

---

## 13. MongoDB Collections

| Collection | Purpose |
|---|---|
| `users` | All registered students and admins |
| `requests` | Support tickets |
| `appointments` | Booked appointments |
| `notifications` | System and admin notifications |
| `chat_sessions` | AI chat conversation history |

**Recommended indexes:**
```js
db.users.createIndex({ student_id: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true })
db.requests.createIndex({ student_id: 1, created_at: -1 })
db.appointments.createIndex({ student_id: 1, created_at: -1 })
db.notifications.createIndex({ student_id: 1, is_read: 1 })
db.chat_sessions.createIndex({ session_id: 1 }, { unique: true })
```

---

*© CampusAssist AI — MIT License*
