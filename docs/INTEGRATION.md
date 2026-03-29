# Integration Guide — Connect Your LangGraph Server

This guide walks you through connecting LangGraph Chat UI to your existing LangGraph server with authentication.

## 1. Choose an Auth Mode

| Mode | Best for | DB needed |
|---|---|---|
| `standalone` | Local dev, no auth | No |
| `credentials` | Email/password login | Yes |
| `oauth` | Google/GitHub social login | Yes |
| `email` | Magic link (passwordless) | Yes |
| `oauth-direct` | LangGraph handles OAuth | No |

For detailed comparison, see [Auth Overview](00-OVERVIEW.md).

## 2. Generate a Shared JWT Secret

Both the Chat UI and your LangGraph server must use the **same** secret for JWT verification.

```bash
# Generate a secret
openssl rand -base64 32
```

Set this value in **both**:

| System | Environment variable |
|---|---|
| Chat UI (frontend/.env) | `NEXTAUTH_SECRET=<your-secret>` |
| LangGraph server (.env) | `JWT_SECRET_KEY=<your-secret>` |

> This is the #1 source of integration errors. If you get 401 Unauthorized, check that both values match exactly.

## 3. Configure the Chat UI

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:
```env
AUTH_MODE=credentials          # or oauth, email
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXTAUTH_SECRET=<your-secret>
DATABASE_URL="file:./prisma/dev.db"
```

Set up the database and start:
```bash
pnpm db:setup
pnpm dev
```

## 4. Configure Your LangGraph Server

Add a JWT auth handler to your LangGraph server:

```python
# src/security/auth.py
from langgraph_sdk import Auth
import jwt

auth = Auth()

@auth.authenticate
async def authenticate(headers: dict) -> str:
    token = headers.get("authorization", "").replace("Bearer ", "")
    payload = jwt.decode(token, os.environ["JWT_SECRET_KEY"], algorithms=["HS256"])
    return payload["sub"]  # user ID
```

Update `langgraph.json`:
```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

## 5. Verify the Connection

### Checklist

- [ ] `NEXTAUTH_SECRET` (Chat UI) = `JWT_SECRET_KEY` (LangGraph server) — same value
- [ ] `NEXT_PUBLIC_API_URL` points to your running LangGraph server
- [ ] Chat UI database is set up (`pnpm db:setup`)
- [ ] LangGraph server has the auth handler configured
- [ ] First user signed up (automatically becomes admin)

### Test

1. Start the LangGraph server
2. Start the Chat UI (`pnpm dev`)
3. Sign up at `/register`
4. Send a message — you should see a streaming response

## Troubleshooting

See [Troubleshooting Guide](TROUBLESHOOTING.md) for common errors.
