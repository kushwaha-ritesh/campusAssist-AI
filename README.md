# CampusAssist AI 🎓
**Smart Student Help Desk — University Web Application**

A production-ready, full-stack web application for managing student services at a university, built with React, FastAPI, and MongoDB.

---

## 🚀 Features

### Student Portal
| Feature | Description |
|---|---|
| **Ask AI** | Conversational AI chatbot with rule-based responses (LLM-ready stub) |
| **Find Office** | Searchable office directory with location, contacts & services |
| **Required Documents** | Categorised checklist of required documents |
| **Raise Request** | Submit support tickets with category and priority |
| **Track Request** | Monitor ticket status and admin notes in real time |
| **Book Appointment** | Schedule meetings with any university office |
| **Notifications** | Read personal and broadcast notifications |

### Admin Portal
| Feature | Description |
|---|---|
| **Dashboard** | Live stats — students, requests, appointments |
| **Manage Requests** | Update ticket status and add admin notes |
| **Manage Appointments** | Confirm or cancel booked appointments |
| **Manage Students** | View all students, activate/deactivate accounts |
| **Send Notifications** | Broadcast messages or target specific students |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Zustand, React Router v6, Lucide Icons |
| **Backend** | Python 3.12, FastAPI, Uvicorn, Motor (async MongoDB) |
| **Database** | MongoDB 7 |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Styling** | Custom CSS — IBM Carbon Design inspired |
| **Containerisation** | Docker + Docker Compose |

---

## 📁 Project Structure

```
campusassist/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app & lifespan
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Motor async MongoDB client
│   │   ├── auth.py              # JWT + bcrypt helpers, dependencies
│   │   ├── models/
│   │   │   └── models.py        # All Pydantic models
│   │   └── routers/
│   │       ├── auth.py          # /api/auth/*
│   │       ├── requests.py      # /api/requests/*
│   │       ├── appointments.py  # /api/appointments/*
│   │       ├── notifications.py # /api/notifications/*
│   │       ├── ai_chat.py       # /api/ai/* (stub)
│   │       ├── admin.py         # /api/admin/*
│   │       ├── campus_info.py   # /api/offices, /api/documents
│   │       └── static_data.py   # Office & document data
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routes (student + admin)
│   │   ├── index.css            # IBM-inspired design system
│   │   ├── api/
│   │   │   ├── client.ts        # Axios instance + interceptors
│   │   │   └── endpoints.ts     # All API calls
│   │   ├── store/
│   │   │   └── authStore.ts     # Zustand auth state
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript interfaces
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── AppLayout.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── Topbar.tsx
│   │   └── pages/
│   │       ├── auth/            # LoginPage, RegisterPage
│   │       ├── student/         # All 7 student pages
│   │       └── admin/           # All 5 admin pages
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
│
└── docker-compose.yml
```

---

## ⚡ Quick Start

### Option 1 — Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repo-url>
cd campusassist

# Start all services
docker-compose up --build
```

Open http://localhost:3000

---

### Option 2 — Local Development

**Prerequisites:** Python 3.12+, Node 20+, MongoDB running locally

**Backend:**
```bash
cd backend
cp .env.example .env        # Edit SECRET_KEY
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                 # Runs on http://localhost:3000
```

**API Docs:** http://localhost:8000/docs

---

## 🔐 Authentication

- Students register with a **Student ID** + password.
- Admins register with a **Student ID** + password + **Admin Code** (`ADMIN2024` by default — change in `.env`).
- JWT tokens are stored in `localStorage` and expire after 60 minutes.
- All protected routes redirect to `/login` on `401`.

---

## 🤖 AI Chatbot Integration

The `/api/ai/chat` endpoint is pre-wired and currently uses a **rule-based stub**. To plug in a real LLM:

1. Open [`backend/app/routers/ai_chat.py`](backend/app/routers/ai_chat.py)
2. Replace the body of `generate_ai_response()` with your preferred integration:
   - **IBM Watson Assistant** — use `ibm-watson` SDK
   - **OpenAI GPT** — use `openai` SDK
   - **LangChain** — swap in a `ConversationChain`
3. Chat sessions are persisted in MongoDB (`chat_sessions` collection).

---

## 🌐 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `DATABASE_NAME` | `campusassist` | Database name |
| `SECRET_KEY` | *(change this!)* | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token expiry |
| `ADMIN_REGISTRATION_CODE` | `ADMIN2024` | Code required for admin sign-up |

---

## 📄 License

MIT © CampusAssist AI
