# Troubleshooting

## 401 Unauthorized on every chat request

**Cause**: JWT secret mismatch between Chat UI and LangGraph server.

**Fix**:
1. Check `NEXTAUTH_SECRET` in `frontend/.env`
2. Check `JWT_SECRET_KEY` in your LangGraph server `.env`
3. They must be **exactly the same** value
4. Restart both servers after changing

## Connection refused / ECONNREFUSED

**Cause**: Chat UI cannot reach the LangGraph server.

**Fix**:
1. Verify your LangGraph server is running: `curl http://localhost:2024/ok`
2. Check `NEXT_PUBLIC_API_URL` in `frontend/.env` matches the server URL
3. In Docker: use `LANGGRAPH_API_URL=http://langgraph-api:8000` for internal network, and `NEXT_PUBLIC_API_URL=http://localhost:8123` for browser access

## Database migration fails

**Cause**: Wrong `DATABASE_PROVIDER` or `DATABASE_URL` format.

**Fix**:
| Provider | URL format |
|---|---|
| sqlite | `file:./prisma/dev.db` |
| postgresql | `postgresql://user:pass@host:5432/dbname` |
| mysql | `mysql://user:pass@host:3306/dbname` |

Run: `DATABASE_PROVIDER=postgresql pnpm db:setup`

## OAuth callback error (redirect_uri_mismatch)

**Cause**: OAuth provider callback URL doesn't match `NEXTAUTH_URL`.

**Fix**:
1. Set `NEXTAUTH_URL=http://localhost:3000` (or your production URL)
2. In Google/GitHub OAuth app settings, add callback URL:
   - Google: `http://localhost:3000/api/auth/callback/google`
   - GitHub: `http://localhost:3000/api/auth/callback/github`

## "File upload is disabled" (403)

**Cause**: Admin disabled file uploads in Global Settings.

**Fix**: Go to `/admin` → Settings → enable "File Upload".

## App starts but shows blank page

**Cause**: Missing or invalid environment variables.

**Fix**: Check server logs for the startup validation error. Required variables depend on your `AUTH_MODE` — see [Environment Variable Matrix](ENV_MATRIX.md).

## SQLite errors on Vercel / serverless

**Cause**: SQLite requires a persistent filesystem, which serverless platforms don't provide.

**Fix**: Switch to PostgreSQL:
```env
DATABASE_PROVIDER=postgresql
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## Thread messages not isolated between users

**Cause**: LangGraph server auth handler is not filtering by user.

**Fix**: Add per-user filtering in your LangGraph auth handler:
```python
@auth.on
async def add_owner(ctx, value):
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```
