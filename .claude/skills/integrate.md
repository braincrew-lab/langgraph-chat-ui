---
name: integrate
description: Guide users through connecting LangGraph Chat UI to their LangGraph server with auth setup
user_invocable: true
---

# LangGraph Chat UI Integration Skill

When the user invokes `/integrate`, guide them step-by-step through connecting this Chat UI to their LangGraph server.

## Steps

### Step 1: Detect current state
- Read `frontend/.env` to check current configuration
- Check if `AUTH_MODE` is already set
- Check if `NEXT_PUBLIC_API_URL` is configured
- Check if database exists (`frontend/prisma/dev.db`)

### Step 2: Ask the user for their setup
Ask the user:
1. **Auth mode**: Do you need authentication? (standalone for no auth, credentials for email/password, oauth for social login)
2. **LangGraph server URL**: Where is your LangGraph server running? (default: http://localhost:2024)
3. **Database**: SQLite (dev) or PostgreSQL (production)?

### Step 3: Generate JWT secret
If auth mode requires it (credentials, oauth, email):
```bash
openssl rand -base64 32
```
Save this value — it must be set in BOTH the Chat UI and LangGraph server.

### Step 4: Configure frontend/.env
Write the `.env` file with the user's choices:
```env
AUTH_MODE=<chosen-mode>
NEXT_PUBLIC_AUTH_MODE=<chosen-mode>
NEXT_PUBLIC_API_URL=<langgraph-url>
NEXTAUTH_SECRET=<generated-secret>
DATABASE_URL=<appropriate-for-provider>
DATABASE_PROVIDER=<sqlite|postgresql|mysql>
```

### Step 5: Set up database
Run:
```bash
cd frontend && pnpm db:setup
```

### Step 6: Generate LangGraph server auth handler
If auth mode is not standalone, create the auth handler file for the user's LangGraph server.

Ask the user for their LangGraph server directory, then create:

**`src/security/auth.py`**:
```python
import os
import jwt
from langgraph_sdk import Auth

auth = Auth()

@auth.authenticate
async def authenticate(headers: dict) -> str:
    authorization = headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise Auth.exceptions.HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(
            token,
            os.environ["JWT_SECRET_KEY"],
            algorithms=["HS256"]
        )
        return payload["sub"]
    except jwt.InvalidTokenError as e:
        raise Auth.exceptions.HTTPException(status_code=401, detail=str(e))

@auth.on
async def add_owner(ctx, value):
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

Also update the user's LangGraph server `.env`:
```env
JWT_SECRET_KEY=<same-secret-as-NEXTAUTH_SECRET>
```

### Step 7: Verify
Run a verification checklist:
- [ ] Chat UI `NEXTAUTH_SECRET` matches LangGraph `JWT_SECRET_KEY`
- [ ] `NEXT_PUBLIC_API_URL` points to the running LangGraph server
- [ ] Database is initialized
- [ ] LangGraph server has auth handler (if not standalone)

Then start the dev server:
```bash
cd frontend && pnpm dev
```

### Important notes
- Always use `docs/ENV_MATRIX.md` as the reference for which env vars are needed per mode
- Always use `docs/TROUBLESHOOTING.md` for common error resolution
- The JWT secret must be identical on both sides — this is the most common integration error
