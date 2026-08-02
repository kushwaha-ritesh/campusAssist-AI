# Email OTP Verification Plan — Registration + Forgot Password

## Overview

Add email OTP verification to two flows:

1. **Registration** — user must verify their email with a 6-digit OTP before the account
   is created in the database
2. **Forgot Password** — user enters their email or student/admin ID, receives an OTP,
   enters it, then sets a new password

**Email provider:** Brevo (formerly Sendinblue) via their transactional email REST API.  
**OTP rate limit:** max 3 OTP sends per email per 24-hour window.  
**Error messaging:** specific messages for unknown email, unknown ID, wrong OTP, expired OTP,
rate limit exceeded.

---

## New MongoDB Collection: `otp_records`

```json
{
  "_id": ObjectId,
  "email": "user@university.edu",
  "otp_hash": "bcrypt-hash-of-6-digit-code",
  "purpose": "register | reset_password",
  "send_count": 2,
  "window_start": ISODate,
  "expires_at": ISODate,
  "verified": false
}
```

- `send_count` resets when `window_start` is older than 24 hours
- `expires_at` is 10 minutes after the OTP was last sent
- `verified` flipped to `true` once the user submits the correct OTP — prevents reuse
- One document per `(email, purpose)` pair — upserted on each send

---

## API Endpoints Added

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/send-otp` | Send OTP to email (register or reset_password) |
| POST | `/api/auth/verify-otp` | Verify OTP code is correct (does NOT consume it yet) |
| POST | `/api/auth/register` | Unchanged path — now checks OTP is verified before creating account |
| POST | `/api/auth/reset-password` | New — accepts email/ID + OTP + new password, resets it |

---

## Sub-Tasks

---

### Sub-Task 1 — Backend: Brevo email service + OTP logic

**Intent:**
Add Brevo API key to config, create `backend/app/email_service.py` that sends
transactional OTP emails via Brevo's REST API using `httpx`.
Create `backend/app/otp.py` with all OTP database operations:
generate, store (hashed), verify, and rate-limit checks.

**Expected Outcomes:**
- `config.py` has `brevo_api_key: str = ""` and `brevo_sender_email: str = ""`
  and `brevo_sender_name: str = "CampusAssist AI"`
- `backend/app/email_service.py` sends a clean HTML OTP email via Brevo REST API
  (`POST https://api.brevo.com/v3/smtp/email`)
- `backend/app/otp.py` exposes:
  - `send_otp(email, purpose) -> None` — generates 6-digit OTP, hashes with bcrypt,
    upserts to `otp_records`, enforces 3/24h rate limit, calls email_service
  - `verify_otp(email, purpose, code) -> bool` — checks hash, checks expiry,
    marks `verified=True` if correct
  - `is_verified(email, purpose) -> bool` — used by register/reset endpoints
    to confirm OTP was verified before proceeding
- `backend/.env.example` updated with Brevo keys

**Todo List:**
1. Add to `config.py`: `brevo_api_key`, `brevo_sender_email`, `brevo_sender_name`
2. Create `backend/app/email_service.py`:
   - `send_otp_email(to_email, otp_code, purpose)` — calls Brevo REST API
   - HTML email template with the 6-digit code prominently displayed
   - Falls back to `print()` log if `brevo_api_key` is empty (dev mode)
3. Create `backend/app/otp.py`:
   - `_get_or_create_record(db, email, purpose)` — fetch existing record or None
   - `send_otp(email, purpose)` — rate limit check → generate → hash → upsert → send email
   - `verify_otp(email, purpose, code) -> bool` — verify hash + expiry + not already used
   - `is_verified(email, purpose) -> bool` — check verified flag
   - `consume_otp(email, purpose)` — delete record after successful use
4. Update `backend/.env.example` with Brevo keys

**Relevant Context:**
- `backend/app/config.py` — `Settings` class
- `backend/requirements.txt` — `httpx` already present (use for Brevo REST call)
- `backend/app/auth.py` — `hash_password`, `verify_password` (reuse passlib for OTP hash)
- MongoDB collection: `otp_records`

**Status:** [ ] pending

---

### Sub-Task 2 — Backend: Update auth router for OTP-gated registration + forgot password

**Intent:**
Add three new endpoints to `auth.py`:
- `POST /api/auth/send-otp` — validates email/ID exists (for reset) or doesn't exist
  (for register), enforces rate limit, sends OTP
- `POST /api/auth/verify-otp` — verifies the code, returns success/error
- `POST /api/auth/reset-password` — verifies OTP is verified, looks up user, resets password

Modify existing `POST /api/auth/register` to check `is_verified(email, "register")`
before creating the account.

**Expected Outcomes:**
- `POST /api/auth/send-otp` body: `{ email, purpose: "register"|"reset_password", identifier?: string }`
  - For `register`: returns 400 if email already exists; returns 429 if rate limit hit
  - For `reset_password`: accepts `email` OR `identifier` (student/admin ID); 
    returns specific 404 if neither is found: "No account found with that email address"
    or "No account found with that Student/Admin ID"
  - On success: sends OTP, returns `{ message: "OTP sent to {email}" }`
- `POST /api/auth/verify-otp` body: `{ email, purpose, code }`
  - Returns 400 "Invalid or expired OTP" if wrong/expired
  - Returns 200 `{ message: "OTP verified" }` if correct
- `POST /api/auth/reset-password` body: `{ email, purpose: "reset_password", new_password }`
  - Returns 400 if OTP not verified
  - Validates new password against same strength rules
  - Updates `hashed_password` in `db.users`, calls `consume_otp()`
- Modified `POST /api/auth/register`:
  - Before creating account: check `await is_verified(email, "register")`
  - If not verified: return 403 "Email not verified. Please verify your email with OTP first."
  - After creating account: call `consume_otp(email, "register")`

**Todo List:**
1. Add `OTPRequest`, `OTPVerifyRequest`, `ResetPasswordRequest` Pydantic models to `models.py`
2. Add `POST /api/auth/send-otp` endpoint with email/ID lookup and rate limit handling
3. Add `POST /api/auth/verify-otp` endpoint
4. Add `POST /api/auth/reset-password` endpoint with password strength validation
5. Modify `POST /api/auth/register` to gate on `is_verified`

**Relevant Context:**
- `backend/app/routers/auth.py` — existing register/login endpoints
- `backend/app/otp.py` (Sub-Task 1) — `send_otp`, `verify_otp`, `is_verified`, `consume_otp`
- `backend/app/models/models.py` — add new request models
- Error messages must be specific: distinguish "email not found" vs "ID not found"

**Status:** [ ] pending

---

### Sub-Task 3 — Frontend: OTP step in RegisterPage

**Intent:**
Add a two-step OTP flow to `RegisterPage.tsx`:

Step 1 — existing form (name, email, password etc.)  
Step 2 — OTP entry screen (after clicking "Send OTP")  
Step 3 — existing success screen (after OTP verified + account created)

The OTP entry screen shows the email address the code was sent to, a 6-digit input,
a countdown timer (10 min), a "Resend OTP" button (disabled until 60 seconds and
shows remaining resend attempts), and a clear error if the code is wrong.

**Expected Outcomes:**
- After filling the form and clicking "Send OTP": API call to `send-otp`, UI transitions
  to OTP entry screen
- OTP entry screen:
  - "A 6-digit code was sent to your-email@domain.com"
  - Single 6-input field OR one input for the full 6-digit code
  - "Verify & Create Account" button — calls `verify-otp` then `register`
  - "Resend OTP" button — disabled for 60s after each send, shows remaining attempts
    (e.g. "2 attempts remaining")
  - Countdown: "Code expires in 9:43"
  - Error: "Incorrect OTP. Please try again." / "OTP has expired. Please request a new one."
  - "← Change email" link returns to step 1 with form pre-filled
- `authApi` extended with `sendOtp`, `verifyOtp` calls

**Todo List:**
1. Add to `frontend/src/api/endpoints.ts` in `authApi`:
   - `sendOtp(email, purpose)` → POST `/auth/send-otp`
   - `verifyOtp(email, purpose, code)` → POST `/auth/verify-otp`
   - `resetPassword(email, newPassword)` → POST `/auth/reset-password`
2. Rewrite `RegisterPage.tsx` to add OTP step between form and success:
   - State: `step: 'form' | 'otp' | 'success'`
   - On form submit → call `sendOtp` → set `step = 'otp'`
   - On OTP verify → call `verifyOtp` → call `register` → set `step = 'success'`
   - Resend logic: track `sendCount` (max 3), `lastSentAt`, 60s cooldown
   - Countdown timer using `useEffect` + `setInterval`

**Relevant Context:**
- `frontend/src/pages/auth/RegisterPage.tsx` — full rewrite with step state
- `frontend/src/api/endpoints.ts` — extend `authApi`

**Status:** [ ] pending

---

### Sub-Task 4 — Frontend: Forgot Password page

**Intent:**
Create a new `ForgotPasswordPage.tsx` with a 3-step flow:

Step 1 — enter email OR student/admin ID  
Step 2 — enter OTP (same UI pattern as registration)  
Step 3 — enter and confirm new password, then success

Add a "Forgot password?" link to `LoginPage.tsx` below the password field.
Add the route to `App.tsx`.

**Expected Outcomes:**
- `LoginPage.tsx` has "Forgot password?" link below the password input
  that navigates to `/forgot-password`
- `ForgotPasswordPage.tsx`:
  - **Step 1**: input labelled "Email address or Student/Admin ID" with a
    "Send OTP" button. Specific errors:
    - "No account found with that email address."
    - "No account found with that Student/Admin ID."
    - "OTP limit reached. You can request a maximum of 3 OTPs per 24 hours."
  - **Step 2**: OTP entry (same as registration — 6-digit, countdown, resend, remaining attempts)
  - **Step 3**: New password + confirm password with the same live strength checklist
    from RegisterPage. "Reset Password" button calls `resetPassword`.
    On success: toast + redirect to `/login`
- Route `/forgot-password` added to `App.tsx` (public route, redirects to dashboard if already logged in)

**Todo List:**
1. Create `frontend/src/pages/auth/ForgotPasswordPage.tsx` with 3-step flow
2. Add "Forgot password?" link to `LoginPage.tsx`
3. Add route in `App.tsx`: `<Route path="/forgot-password" element={...} />`

**Relevant Context:**
- `frontend/src/pages/auth/LoginPage.tsx` — add link below password field
- `frontend/src/pages/auth/RegisterPage.tsx` — reuse OTP step and password strength UI pattern
- `frontend/src/App.tsx` — add public route
- `frontend/src/api/endpoints.ts` — `authApi.sendOtp`, `authApi.verifyOtp`, `authApi.resetPassword`

**Status:** [ ] pending

---

## Environment Variables

### backend/.env (add these)
```
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=CampusAssist AI
```

### Render (add same keys in dashboard)

---

## Error Message Reference

| Scenario | HTTP | Message shown to user |
|---|---|---|
| Email already registered (register) | 400 | "This email is already registered." |
| Email not found (reset) | 404 | "No account found with that email address." |
| Student/Admin ID not found (reset) | 404 | "No account found with that Student/Admin ID." |
| OTP rate limit hit | 429 | "OTP limit reached. You can request a maximum of 3 OTPs per 24 hours." |
| Wrong OTP | 400 | "Incorrect OTP. Please try again." |
| Expired OTP | 400 | "OTP has expired. Please request a new one." |
| OTP not verified (register) | 403 | "Email not verified. Please verify your email with OTP first." |
| OTP not verified (reset) | 403 | "OTP not verified. Please complete OTP verification first." |
| Weak password (reset) | 422 | "Password must contain: ..." (lists failed rules) |

---

## Notes

- Sub-tasks must be done in order: 1 → 2 → 3 → 4
- Brevo free tier allows 300 emails/day — more than enough for a university helpdesk
- OTP is a 6-digit number (100000–999999), hashed with bcrypt before storing
- OTP expiry is 10 minutes from last send time
- 60-second resend cooldown is frontend-only (UX); rate limit is enforced server-side
- `consume_otp` deletes the record after use so OTPs cannot be reused
- If `BREVO_API_KEY` is empty the OTP is printed to the server log (dev mode — no emails sent)
