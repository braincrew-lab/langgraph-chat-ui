# API Key Mode Setup (LangGraph Cloud)

Simplest mode. LangGraph Cloud validates API keys natively — no custom auth handler needed.

## Frontend .env

Write to `frontend/.env`:

### With auto-login (API key in env):
```env
AUTH_MODE=api-key
NEXT_PUBLIC_AUTH_MODE=api-key
NEXT_PUBLIC_API_URL=https://your-deployment.dev.langsmith.com
NEXT_PUBLIC_LANGCHAIN_API_KEY=lsv2_pt_...
```

### With user input form (no auto-login):
```env
AUTH_MODE=api-key
NEXT_PUBLIC_AUTH_MODE=api-key
NEXT_PUBLIC_API_URL=https://your-deployment.dev.langsmith.com
```

If `NEXT_PUBLIC_LANGCHAIN_API_KEY` is omitted, users see an API key input form.

## Backend

No auth handler needed. LangGraph Cloud validates API keys natively.

Ensure `langgraph.json` does NOT have an `auth` section:
```json
{
  "define": "src/graph.py:graph"
}
```

## Database

Not needed for api-key mode.

## Verification

- [ ] Frontend `.env` has `AUTH_MODE=api-key`
- [ ] `NEXT_PUBLIC_API_URL` points to LangGraph Cloud deployment
- [ ] API key format starts with `lsv2_pt_`
- [ ] No `auth` section in backend `langgraph.json`

## Notes

- API key represents the entire deployment, not individual users
- No per-user thread isolation
- Rotate keys regularly in LangGraph Cloud dashboard
- Never commit API keys to git
