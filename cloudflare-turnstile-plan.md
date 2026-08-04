# Cloudflare Turnstile Integration Plan

## Top-Level Overview

Add Cloudflare Turnstile bot-protection to three auth flows:

1. **Login** — verify before credentials are checked
2. **Register → Send OTP** — verify before the verification email is dispatched (Step 1 of registration)
3. **Forgot Password → Send OTP** — verify before the reset email is dispatched (Step 1 of forgot-password)

**Approach:**
- Frontend: render the Turnstile widget on each targeted form; collect the `cf-turnstile-response` token on submission and include it in the API request body.
- Backend: add a shared `verify_turnstile(token)` async helper that calls Cloudflare's siteverify endpoint; call it at the top of the three affected endpoints before any business logic runs.
- Environment: add `CLOUDFLARE_TURNSTILE_SECRET_KEY` to the backend and `VITE_TURNSTILE_SITE_KEY` to the frontend.

**Non-goals:** No changes to OTP logic, password logic, JWT logic, or any other endpoint.

---

## Sub-Tasks

---

### Sub-Task 1 — Backend: Turnstile verification helper + env config

**Intent:**
Create a single reusable async function `verify_turnstile(token: str)` that calls the Cloudflare siteverify API. Wire the secret key into `Settings`. This helper is called by three endpoints.

**Expected Outcomes:**
- `backend/app/config.py` has a new `cloudflare_turnstile_secret_key: str = ""` field.
- `backend/app/turnstile.py` exists with one async function `verify_turnstile(token: str) -> None` that raises `HTTPException(400)` on failure and is a no-op when the secret key is not configured (dev fallback).
- `backend/.env.example` has a `CLOUDFLARE_TURNSTILE_SECRET_KEY=` entry.

**Todo List:**
1. Add `cloudflare_turnstile_secret_key: str = ""` to `Settings` in `backend/app/config.py`.
2. Create `backend/app/turnstile.py`:
   - Import `httpx`, `get_settings`, `HTTPException`.
   - Define `async def verify_turnstile(token: str) -> None`.
   - If secret key is empty, log a dev warning and return (no-op).
   - POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret` + `response=token`.
   - If `success` is `False` in the JSON response, raise `HTTPException(status_code=400, detail="Human verification failed. Please try again.")`.
3. Append `CLOUDFLARE_TURNSTILE_SECRET_KEY=your-secret-key-here` to `backend/.env.example`.

**Relevant Context:**
- `backend/app/config.py` — `Settings` class, add one field.
- `backend/app/email_service.py` — reference pattern for `httpx.AsyncClient` usage.
- Cloudflare siteverify endpoint: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with form fields `secret` and `response`.

**Status:** [ ] pending

---

### Sub-Task 2 — Backend: Wire `verify_turnstile` into the three endpoints

**Intent:**
Call `verify_turnstile` at the start of `/send-otp` (for both register and reset_password purposes), `/login`, so that any request without a valid Turnstile token is rejected before any DB or email work happens.

**Expected Outcomes:**
- `OTPRequest` model has an optional `turnstile_token: Optional[str] = None` field.
- `LoginPayload` on the backend accepts a `turnstile_token` field — because login uses `OAuth2PasswordRequestForm` (URL-encoded), a small wrapper or a separate JSON body approach is needed (see design note below).
- Each of the three endpoints calls `await verify_turnstile(payload.turnstile_token or "")` as the very first line of logic.

**Design note — Login endpoint:**
The current `/login` uses `OAuth2PasswordRequestForm` (URL-encoded). Turnstile token cannot be added to that form without changing the request format. The cleanest minimal change: add a new `LoginRequest` Pydantic model (`username`, `password`, `turnstile_token`) and change the endpoint to accept JSON body instead of form. Update `authApi.login` in the frontend accordingly (already uses axios, just remove the URLSearchParams encoding).

**Todo List:**
1. In `backend/app/models/models.py`:
   - Add `turnstile_token: Optional[str] = None` to `OTPRequest`.
   - Add a new `LoginRequest` model with `username: str`, `password: str`, `turnstile_token: Optional[str] = None`.
2. In `backend/app/routers/auth.py`:
   - Import `verify_turnstile` from `app.turnstile`.
   - Change `POST /login` to accept `LoginRequest` (JSON body) instead of `OAuth2PasswordRequestForm`. Add `await verify_turnstile(payload.turnstile_token or "")` as first line.
   - In `POST /send-otp`, add `await verify_turnstile(payload.turnstile_token or "")` as first line (after resolving email but this call should happen before any DB interaction — place it right after argument validation, before the DB lookup and rate-limit check).

**Relevant Context:**
- `backend/app/routers/auth.py` — `login` (line 193), `send_otp_endpoint` (line 29).
- `backend/app/models/models.py` — `OTPRequest` (line 149).
- `backend/app/turnstile.py` — created in Sub-Task 1.

**Status:** [ ] pending

---

### Sub-Task 3 — Frontend: Add Turnstile widget to Login, Register, Forgot Password

**Intent:**
Render the Cloudflare Turnstile widget on each targeted form, capture the token when the challenge completes, and include it in the API call. Use the official `@marsidev/react-turnstile` package (the standard community React wrapper).

**Expected Outcomes:**
- `@marsidev/react-turnstile` is installed in `frontend/`.
- `VITE_TURNSTILE_SITE_KEY` is documented in a `frontend/.env.example`.
- `LoginPage.tsx`: Turnstile widget rendered in the form; token captured; passed as `turnstile_token` in the login API call.
- `RegisterPage.tsx` (Step 1): Turnstile widget rendered above the "Send Verification Email" button; token captured; passed as `turnstile_token` in `authApi.sendOtp(...)`.
- `ForgotPasswordPage.tsx` (Step 1): Same pattern — widget above the "Send OTP" button; token captured; passed in `authApi.sendOtp(...)`.
- The Turnstile widget resets (via `ref.current.reset()`) on failed API calls so the user can retry.
- `authApi.sendOtp` and `authApi.login` in `endpoints.ts` updated to accept and forward `turnstile_token`.

**Todo List:**
1. Run `npm install @marsidev/react-turnstile` in `frontend/`.
2. Create `frontend/.env.example` with `VITE_API_URL=http://localhost:8000/api` and `VITE_TURNSTILE_SITE_KEY=your-site-key-here`.
3. Update `authApi.login` in `frontend/src/api/endpoints.ts`:
   - Change from URLSearchParams to JSON body `{ username, password, turnstile_token }`.
4. Update `authApi.sendOtp` in `frontend/src/api/endpoints.ts`:
   - Add optional `turnstile_token?: string` parameter and include it in the POST body.
5. In `frontend/src/pages/auth/LoginPage.tsx`:
   - Import `Turnstile` from `@marsidev/react-turnstile`.
   - Add a `turnstileToken` state variable.
   - Render `<Turnstile siteKey={...} onSuccess={setTurnstileToken} onError/onExpire={() => setTurnstileToken('')} />` inside the form.
   - Pass `turnstileToken` to `authApi.login(...)`.
   - Reset the widget on login failure.
6. In `frontend/src/pages/auth/RegisterPage.tsx` (Step 1 / `handleSendOtp`):
   - Same pattern: add `turnstileToken` state, render widget, pass token to `authApi.sendOtp(...)`, reset on error.
7. In `frontend/src/pages/auth/ForgotPasswordPage.tsx` (Step 1 / `handleSendOtp`):
   - Same pattern as Register Step 1.

**Relevant Context:**
- `frontend/src/pages/auth/LoginPage.tsx` — `handleSubmit` (line 29), form JSX.
- `frontend/src/pages/auth/RegisterPage.tsx` — `handleSendOtp` (line 86), Step 1 JSX.
- `frontend/src/pages/auth/ForgotPasswordPage.tsx` — `handleSendOtp` (line 72), Step 1 JSX.
- `frontend/src/api/endpoints.ts` — `authApi.login` (line 13), `authApi.sendOtp` (line 22).
- `@marsidev/react-turnstile` docs: `<Turnstile siteKey ref onSuccess onError onExpire />`. The `ref` exposes `.reset()`.

**Status:** [ ] pending

---

## Environment Variables Summary

| Variable | Where | Purpose |
|---|---|---|
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | `backend/.env` | Server-side token verification |
| `VITE_TURNSTILE_SITE_KEY` | `frontend/.env` | Widget rendering (public key) |

Get both keys from the [Cloudflare Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile).
For local development, use Cloudflare's always-pass test keys:
- Site key: `1x00000000000000000000AA`
- Secret key: `1x0000000000000000000000000000000AA`
