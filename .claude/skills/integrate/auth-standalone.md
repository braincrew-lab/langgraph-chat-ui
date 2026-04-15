# Standalone Mode Setup

No authentication. Best for local development and demos.

## Frontend .env

Write to `frontend/.env`:
```env
AUTH_MODE=standalone
NEXT_PUBLIC_AUTH_MODE=standalone
NEXT_PUBLIC_API_URL=<langgraph-server-url>
```

Default `NEXT_PUBLIC_API_URL` is `http://localhost:2024`.

## Backend

No auth handler needed. Remove or skip `auth` section in `langgraph.json`.

Ensure `langgraph.json` does NOT have an `auth` key, or remove it if present.

## Database

Not needed for standalone mode.

## Verification

- [ ] Frontend `.env` has `AUTH_MODE=standalone`
- [ ] `NEXT_PUBLIC_API_URL` points to running LangGraph server
- [ ] No `auth` section in backend `langgraph.json`

Start the dev server:
```bash
cd frontend && pnpm dev
```
