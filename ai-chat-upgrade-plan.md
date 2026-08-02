# AI Chat Upgrade Plan — Gemini RAG + Live Streaming

## Overview

Replace the rule-based keyword stub with a full Retrieval-Augmented Generation (RAG) pipeline
powered by Google Gemini. The chatbot answers **only from university data** stored in MongoDB.
A background crawler periodically fetches new notices, circulars, timetables, and FAQs from
the university website and indexes them into MongoDB as searchable knowledge chunks.
The frontend streams Gemini's reply token-by-token for a live conversation feel.

**Out of scope:** Fine-tuning, voice chat (architecture will not block it), changing any
existing feature outside ai_chat.py and AskAIPage.tsx.

---

## Architecture

```
User message
    │
    ▼
FastAPI /api/ai/chat/stream  (SSE)
    │
    ├─► Embed user message  (Gemini text-embedding-004)
    │
    ├─► Vector search in db.knowledge_chunks  (MongoDB Atlas $vectorSearch)
    │       Returns top-k relevant chunks (notices, FAQs, offices, etc.)
    │
    ├─► Build prompt:  system_prompt + retrieved_chunks + conversation_history
    │
    ├─► Call Gemini 2.0 Flash  (stream=True)
    │       Yields tokens one by one
    │
    ├─► Stream each token to frontend via SSE  (data: <token>\n\n)
    │
    └─► On DONE: save full exchange to db.chat_sessions
```

---

## Collections Used

| Collection | Purpose |
|---|---|
| `chat_sessions` | Existing — stores full conversation history per student |
| `knowledge_chunks` | New — stores university data chunks with vector embeddings |
| `crawl_log` | New — tracks last crawl time and status per source URL |

### `knowledge_chunks` document shape
```json
{
  "_id": ObjectId,
  "source": "notice | faq | office | timetable | circular | placement",
  "title": "string",
  "content": "string  (the raw text chunk)",
  "url": "string or null",
  "embedding": [0.123, ...],   // 768-dim float array
  "crawled_at": ISODate,
  "expires_at": ISODate or null
}
```

---

## Sub-Tasks

---

### Sub-Task 1 — Dependencies and Config

**Intent:**
Add all new Python packages and expose their config keys through Settings,
keeping existing behaviour unchanged if no API key is set.

**Expected Outcomes:**
- `requirements.txt` has `google-generativeai>=0.8`, `apscheduler>=3.10`, `beautifulsoup4>=4.12`, `httpx` (already present)
- `config.py` Settings has: `gemini_api_key`, `gemini_model`, `gemini_embedding_model`,
  `university_base_url`, `crawl_interval_hours`
- `backend/.env.example` documents all new keys

**Todo List:**
1. Add to `backend/requirements.txt`:
   - `google-generativeai>=0.8`
   - `apscheduler>=3.10`
   - `beautifulsoup4>=4.12`
2. Add to `Settings` in `backend/app/config.py`:
   - `gemini_api_key: str = ""`
   - `gemini_model: str = "gemini-2.0-flash"`
   - `gemini_embedding_model: str = "models/text-embedding-004"`
   - `university_base_url: str = ""` — base URL of university website to crawl
   - `crawl_interval_hours: int = 6` — how often background crawl runs
3. Update `backend/.env.example` with all new keys and comments

**Relevant Context:**
- `backend/requirements.txt`
- `backend/app/config.py` — `Settings` class

**Status:** [ ] pending

---

### Sub-Task 2 — Knowledge Base: MongoDB Atlas Vector Search setup

**Intent:**
Create `backend/app/knowledge.py` — a module that owns all RAG operations:
embed a query, search knowledge_chunks by vector similarity, upsert new chunks,
and expose a helper to seed the DB with the static office/document data already in
`static_data.py` so the chatbot can answer office questions from day one.

**Expected Outcomes:**
- `backend/app/knowledge.py` exists with:
  - `embed_text(text) -> list[float]` — calls Gemini embedding API
  - `search_chunks(query, top_k=5) -> list[dict]` — MongoDB `$vectorSearch` or
    fallback text search if Atlas Vector Search index not yet created
  - `upsert_chunk(source, title, content, url) -> None` — embeds and stores/updates a chunk
  - `seed_static_data()` — converts OFFICES and REQUIRED_DOCUMENTS into chunks and upserts them
- Running `seed_static_data()` on startup populates knowledge_chunks if empty
- Falls back gracefully (returns empty list) when `gemini_api_key` is empty

**Todo List:**
1. Create `backend/app/knowledge.py`
2. Implement `embed_text()` using `genai.embed_content(model=settings.gemini_embedding_model, content=text)`
3. Implement `search_chunks()`:
   - Primary: `db.knowledge_chunks.aggregate([{"$vectorSearch": {...}}])` (Atlas Vector Search)
   - Fallback: `db.knowledge_chunks.find({"$text": {"$search": query}}).limit(top_k)` (text index)
   - Returns list of `{title, content, source, url}` dicts
4. Implement `upsert_chunk()`: embed content, then `update_one({source, title}, {$set: {...}}, upsert=True)`
5. Implement `seed_static_data()`: import OFFICES and REQUIRED_DOCUMENTS from static_data.py,
   convert each to a chunk, call `upsert_chunk` for each
6. In `backend/app/main.py` lifespan, after `connect_db()`, call `await seed_static_data()`
   only when `settings.gemini_api_key` is non-empty

**Relevant Context:**
- `backend/app/routers/static_data.py` — OFFICES, REQUIRED_DOCUMENTS to seed from
- `backend/app/database.py` — `get_db()`
- `backend/app/config.py` — `get_settings()`
- `backend/app/main.py` — lifespan function to add seed call

**Status:** [ ] pending

---

### Sub-Task 3 — Background Web Crawler

**Intent:**
Create `backend/app/crawler.py` — an APScheduler background job that periodically fetches
the university website's notice board, FAQ, and timetable pages, extracts clean text,
splits it into chunks, and upserts them into `knowledge_chunks`. This keeps the chatbot
up to date without any manual intervention.

**Expected Outcomes:**
- `backend/app/crawler.py` exists with:
  - `crawl_once()` async function — fetches configured pages, parses HTML with BeautifulSoup,
    splits text into ~500-token chunks, calls `knowledge.upsert_chunk()` for each
  - `start_crawler(app)` — registers the APScheduler `AsyncIOScheduler` job to run
    `crawl_once()` every `settings.crawl_interval_hours` hours
- The scheduler is started in `main.py` lifespan only when `university_base_url` is set
- Crawl progress (source URL, chunks added, timestamp) is logged to `db.crawl_log`
- Gracefully skips if the URL is unreachable (logs warning, does not crash the server)

**Todo List:**
1. Create `backend/app/crawler.py`
2. Implement `fetch_page(url) -> str` using `httpx.AsyncClient` — returns raw HTML or empty string on error
3. Implement `extract_chunks(html, source_label, url) -> list[dict]` using BeautifulSoup:
   - Remove nav, header, footer, script, style tags
   - Extract `<p>`, `<li>`, `<h1>`–`<h3>` text
   - Split into chunks of max 500 characters with 50-character overlap
4. Implement `crawl_once()`:
   - Build list of target URLs from `settings.university_base_url` (notices, faq, timetable sub-paths)
   - For each URL: fetch → extract_chunks → upsert each chunk via `knowledge.upsert_chunk()`
   - Write summary to `db.crawl_log`
5. Implement `start_crawler()` using `apscheduler.schedulers.asyncio.AsyncIOScheduler`
6. Call `start_crawler()` in `main.py` lifespan after DB connect, only if `university_base_url` is set

**Relevant Context:**
- `backend/app/knowledge.py` (Sub-Task 2) — `upsert_chunk()` to call
- `backend/app/database.py` — `get_db()` for crawl_log writes
- `backend/app/config.py` — `university_base_url`, `crawl_interval_hours`
- `backend/app/main.py` — lifespan function

**Status:** [ ] pending

---

### Sub-Task 4 — Rewrite ai_chat.py: RAG + Gemini + Streaming

**Intent:**
Replace `generate_ai_response()` with a RAG pipeline that retrieves relevant knowledge chunks,
builds a grounded prompt, and calls Gemini. Add a new `POST /api/ai/chat/stream` SSE endpoint
that streams the reply token-by-token. Keep the existing `POST /api/ai/chat` endpoint as a
non-streaming fallback.

**Expected Outcomes:**
- `generate_rag_response(message, history) -> str` replaces the old stub:
  1. Embeds message → searches knowledge_chunks → retrieves top 5 chunks
  2. Builds a prompt: system instruction + retrieved context + last 10 turns of history + user message
  3. Calls `model.generate_content()` → returns full text
  4. If `gemini_api_key` is empty, falls back to old rule-based logic
- New `POST /api/ai/chat/stream` endpoint:
  - Uses FastAPI `StreamingResponse` with `media_type="text/event-stream"`
  - Calls `model.generate_content(..., stream=True)`
  - Yields `f"data: {chunk.text}\n\n"` for each chunk
  - Yields `"data: [DONE]\n\n"` at end
  - Saves completed exchange to `db.chat_sessions` after streaming finishes
- System prompt instructs Gemini:
  - You are CampusAssist AI, a university student help desk assistant
  - Answer ONLY from the provided context. If not in context, say "I don't have that information — please contact the relevant office or raise a request."
  - Keep responses concise and helpful
  - Reference specific offices, rooms, or phone numbers when available in context

**Todo List:**
1. In `ai_chat.py`, import `knowledge.search_chunks`, `genai`, configure client with `settings.gemini_api_key`
2. Write `build_prompt(message, history, chunks) -> str` that assembles system + context + history + query
3. Rewrite `generate_rag_response()` — embed query, search, build prompt, call Gemini
4. Add `POST /api/ai/chat/stream` using `StreamingResponse`:
   - Accept `message` and `session_id` as query params (GET-friendly for EventSource) OR as body
   - Use `stream=True` in Gemini call
   - Yield SSE events; on completion, persist to DB
5. Keep existing `POST /api/ai/chat` endpoint but swap its internals to call `generate_rag_response()`

**Relevant Context:**
- `backend/app/routers/ai_chat.py` — full file to rewrite
- `backend/app/knowledge.py` (Sub-Task 2) — `search_chunks()` to call
- FastAPI `StreamingResponse` from `fastapi.responses`
- `google.generativeai` — `GenerativeModel`, `generate_content(stream=True)`
- `backend/app/models/models.py` — `ChatRequest`, `ChatMessage`

**Status:** [ ] pending

---

### Sub-Task 5 — Frontend: Live Streaming Chat UI

**Intent:**
Upgrade `AskAIPage.tsx` to connect to the SSE streaming endpoint and render tokens
progressively into a live assistant bubble, giving the ChatGPT-style typing feel.
Architecture must not block a future voice input button.

**Expected Outcomes:**
- Sending a message immediately shows an empty assistant bubble with a blinking cursor
- Tokens from SSE are appended to that bubble as they arrive
- When `[DONE]` is received the cursor disappears and the bubble is complete
- Send button and Enter key are disabled while streaming; Shift+Enter still inserts newline
- Quick-prompt chips work as before
- "New Chat" resets to welcome message and clears session
- A placeholder "🎤 Voice" button is visible in the input bar (disabled, tooltip: "Coming soon") — future-ready hook
- Fallback: if SSE fails, retries with the regular `aiApi.chat()` POST

**Todo List:**
1. Add `streamChat(message, sessionId, onToken, onDone, onError)` to `frontend/src/api/endpoints.ts`:
   - Uses native `fetch` (not Axios) with `Authorization` header
   - Reads response as a `ReadableStream` + `TextDecoder`
   - Parses `data: ...` SSE lines; calls `onToken(text)` for each, `onDone(sessionId)` on `[DONE]`
2. In `AskAIPage.tsx`:
   - Replace `aiApi.chat()` call with `streamChat()`
   - Add `streaming: boolean` state
   - On first token: push empty assistant message to state, set `streaming = true`
   - On each token: append to last message content via functional state update
   - On `[DONE]`: set `streaming = false`, save `session_id`
   - On error: fall back to `aiApi.chat()`, show toast only if fallback also fails
3. Add blinking cursor CSS: a `span.cursor` element shown only when `streaming = true`,
   animated with a `@keyframes blink` in `index.css`
4. Keep three-dot loading indicator for the moment before the first token arrives
5. Add disabled "🎤" icon button next to send button with `title="Voice input — coming soon"`

**Relevant Context:**
- `frontend/src/pages/student/AskAIPage.tsx` — full rewrite of sendMessage()
- `frontend/src/api/endpoints.ts` — add `streamChat()` alongside `aiApi`
- `frontend/src/index.css` — add `@keyframes blink` and `.cursor` style
- `frontend/src/types/index.ts` — `ChatMessage` type (no changes needed)
- `localStorage.getItem('ca_token')` for the Authorization header in fetch

**Status:** [ ] pending

---

## Environment Variables

### backend/.env (local)
```
GEMINI_API_KEY=AQ.Ab8RN6KEp0F-_-...   ← already provided
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=models/text-embedding-004
UNIVERSITY_BASE_URL=                   ← set to your university website URL when ready
CRAWL_INTERVAL_HOURS=6
```

### Render (production)
Same keys added in the Render dashboard Environment tab.

---

## Notes

- **No fine-tuning** — Gemini is used as-is; all university knowledge comes from RAG context
- **MongoDB Atlas Vector Search** is needed for semantic search. The `search_chunks()` function
  falls back to plain text search if the vector index is not yet created — so the app still
  works during setup
- **Atlas Vector Search index** must be created manually in the Atlas UI on the
  `knowledge_chunks` collection, field `embedding`, dimensions `768`, similarity `cosine`
- **Crawler is optional** — if `UNIVERSITY_BASE_URL` is empty, no crawling happens;
  the chatbot still works from the seeded static data (offices, documents)
- **Voice chat** is future-ready: the "🎤" button is wired as a placeholder; connecting the
  Web Speech API later requires only adding a `onMicClick` handler — no architectural changes
- Sub-tasks must be implemented in order (1 → 2 → 3 → 4 → 5) as each depends on the previous
