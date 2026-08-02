# Campus Info Admin Management Plan

## Overview

Move `OFFICES` and `REQUIRED_DOCUMENTS` from the hardcoded `static_data.py` into MongoDB
so they can be updated live from the Admin panel with no code changes or redeployment.

Add a new **"Campus Info"** section to the Admin panel with two tabs:
- **Offices** — add, edit, delete office entries
- **Documents** — add, edit, delete document categories and their document lists

---

## Architecture

```
Admin UI (Campus Info page)
    │
    ├── GET  /api/admin/campus/offices         → list all offices
    ├── POST /api/admin/campus/offices         → add new office
    ├── PUT  /api/admin/campus/offices/:id     → update office
    ├── DELETE /api/admin/campus/offices/:id   → delete office
    │
    ├── GET  /api/admin/campus/documents       → list all categories
    ├── POST /api/admin/campus/documents       → add new category
    ├── PUT  /api/admin/campus/documents/:cat  → update category
    └── DELETE /api/admin/campus/documents/:cat → delete category

Existing student-facing endpoints unchanged:
    GET /api/offices    → reads from MongoDB (was static_data.py)
    GET /api/documents  → reads from MongoDB (was static_data.py)
```

MongoDB collections:
- `offices`   — one document per office
- `documents` — one document per category

---

## Sub-Tasks

---

### Sub-Task 1 — Backend: Migrate to MongoDB + admin CRUD endpoints

**Intent:**
Seed offices and documents into MongoDB on startup (if collections are empty),
then serve them from the database instead of the hardcoded list.
Add admin-only CRUD endpoints in a new router `campus_admin.py`.

**Expected Outcomes:**
- `GET /api/offices` and `GET /api/documents` read from MongoDB (not static_data.py)
- On startup, if `db.offices` is empty → seed from `static_data.py` OFFICES list
- On startup, if `db.documents` is empty → seed from `static_data.py` REQUIRED_DOCUMENTS list
- New router `backend/app/routers/campus_admin.py` with endpoints:
  - `GET    /api/admin/campus/offices`
  - `POST   /api/admin/campus/offices`
  - `PUT    /api/admin/campus/offices/{office_id}`
  - `DELETE /api/admin/campus/offices/{office_id}`
  - `GET    /api/admin/campus/documents`
  - `POST   /api/admin/campus/documents`
  - `PUT    /api/admin/campus/documents/{category}`
  - `DELETE /api/admin/campus/documents/{category}`
- All admin endpoints require `require_admin` dependency
- `campus_info.py` updated to read from `db.offices` / `db.documents`
- New router registered in `main.py`

**Todo List:**
1. Create `backend/app/routers/campus_admin.py` with all 8 endpoints
2. Add Pydantic models `OfficeCreate`, `OfficeUpdate`, `DocumentCategoryCreate`,
   `DocumentCategoryUpdate` to `models.py`
3. Update `campus_info.py` — replace static list returns with `db.offices.find()` and
   `db.documents.find()`, strip `_id` from each document before returning
4. Add `seed_campus_data()` async function in `campus_info.py` that checks if collections
   are empty and seeds from `static_data.py`
5. Call `seed_campus_data()` in `main.py` lifespan after `connect_db()`
6. Register `campus_admin.router` in `main.py`

**Relevant Context:**
- `backend/app/routers/campus_info.py` — to update GET endpoints
- `backend/app/routers/static_data.py` — seed source
- `backend/app/routers/admin.py` — pattern for admin-only endpoints with `require_admin`
- `backend/app/models/models.py` — add new models
- `backend/app/main.py` — register router + call seed

**Status:** [ ] pending

---

### Sub-Task 2 — Frontend: Admin Campus Info page with edit UI

**Intent:**
Add a new "Campus Info" admin page with two tabs — Offices and Documents.
Each tab shows the current data in a table and lets the admin add, edit, and delete entries.
Use the same UI patterns as existing admin pages (cards, tables, `.form-input`, `.btn`).
No modal library needed — use an inline expand/collapse edit form.

**Expected Outcomes:**
- New page `frontend/src/pages/admin/AdminCampusInfoPage.tsx`
- Two tabs: **Offices** and **Documents**
- **Offices tab:**
  - Table showing: Name, Block/Room, Phone, Email, Hours
  - "Edit" button per row → expands an inline form pre-filled with office data
  - "Delete" button per row → confirms then deletes
  - "Add Office" button at top → opens a blank inline form
  - Form fields: name, block, room, phone, email, hours, services (comma-separated input)
- **Documents tab:**
  - Table showing: Category, Number of documents
  - "Edit" button per row → expands inline form with category name + textarea for documents (one per line)
  - "Delete" button per row → confirms then deletes
  - "Add Category" button at top → opens blank inline form
- Success/error feedback via `react-hot-toast`
- Page added to Admin sidebar nav as "Campus Info" with `Building2` icon from lucide-react

**Todo List:**
1. Add API calls to `frontend/src/api/endpoints.ts` under a new `campusAdminApi` object:
   - `listOffices`, `createOffice`, `updateOffice`, `deleteOffice`
   - `listDocuments`, `createDocument`, `updateDocument`, `deleteDocument`
2. Create `frontend/src/pages/admin/AdminCampusInfoPage.tsx`
3. Add route `path="campus-info"` under the `/admin` route in `App.tsx`
4. Add "Campus Info" nav item with `Building2` icon to `ADMIN_NAV` in `Sidebar.tsx`

**Relevant Context:**
- `frontend/src/pages/admin/AdminStudentsPage.tsx` — table + button pattern to follow
- `frontend/src/pages/admin/AdminDashboardPage.tsx` — card/layout pattern
- `frontend/src/api/endpoints.ts` — add `campusAdminApi` alongside `adminApi`
- `frontend/src/App.tsx` — add route
- `frontend/src/components/layout/Sidebar.tsx` — add nav item

**Status:** [ ] pending

---

## Notes

- `static_data.py` stays in place as the seed source — it is not deleted
- The seeding is idempotent only on first run (checks if collection is empty before seeding)
  so manual edits made via the admin panel are never overwritten on restart
- `_id` from MongoDB is stripped and the office's `id` field (e.g. "admissions") is used
  as the human-readable identifier for updates and deletes
- Services in the office form are entered as comma-separated text and split into an array
  before saving; documents in the category form are entered one-per-line
- Sub-tasks must be done in order: 1 (backend) then 2 (frontend)
