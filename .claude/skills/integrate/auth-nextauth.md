# NextAuth Mode Setup (credentials / oauth / email)

Shared setup for all NextAuth-based modes. These modes use HS256 JWT tokens issued by NextAuth.

## Step 1: Generate JWT Secret

```bash
openssl rand -base64 32
```

Save this value — it MUST be set in BOTH frontend and backend.

## Step 2: Frontend .env

Write to `frontend/.env`:

### Common (all NextAuth modes)
```env
AUTH_MODE=<mode>
NEXT_PUBLIC_AUTH_MODE=<mode>
NEXT_PUBLIC_API_URL=<langgraph-server-url>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated-secret>
DATABASE_URL=<database-url>
DATABASE_PROVIDER=<sqlite|postgresql|mysql>
```

### Additional for oauth mode
```env
GOOGLE_CLIENT_ID=<if-using-google>
GOOGLE_CLIENT_SECRET=<if-using-google>
GITHUB_CLIENT_ID=<if-using-github>
GITHUB_CLIENT_SECRET=<if-using-github>
```
At least one OAuth provider is required.

### Additional for email mode
```env
EMAIL_SERVER_HOST=<smtp-host>
EMAIL_SERVER_PORT=<smtp-port>
EMAIL_SERVER_USER=<smtp-user>
EMAIL_SERVER_PASSWORD=<smtp-password>
EMAIL_FROM=<sender-email>
```
All 5 variables are required.

### Database URL examples
- SQLite: `file:./prisma/dev.db`
- PostgreSQL: `postgresql://user:password@localhost:5432/dbname`
- MySQL: `mysql://user:password@localhost:3306/dbname`

## Step 3: Set up Database

```bash
cd frontend && pnpm db:setup
```

## Step 4: Backend auth.py

Create `src/security/auth.py` in the backend server directory:

```python
"""Authentication handler for LangGraph (HS256 JWT from NextAuth).

Validates JWT tokens issued by the Chat UI's NextAuth and isolates
resources per user via owner metadata.

Environment variables:
- NEXTAUTH_SECRET: Same secret as the Chat UI's NEXTAUTH_SECRET
"""

import os

import jwt
from langgraph_sdk import Auth

NEXTAUTH_SECRET = os.environ["NEXTAUTH_SECRET"]

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate NextAuth JWT token."""
    if not authorization:
        raise AUTH_EXCEPTION

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        payload = jwt.decode(token, NEXTAUTH_SECRET, algorithms=["HS256"])

        return {
            "identity": payload["sub"],
            "email": payload.get("email"),
            "display_name": payload.get("name"),
            "is_authenticated": True,
        }

    except (ValueError, jwt.InvalidTokenError):
        raise AUTH_EXCEPTION


@auth.on
async def add_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Isolate threads per user."""
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

## Step 5: Backend .env

Add to the backend server's `.env`:
```env
NEXTAUTH_SECRET=<same-secret-as-frontend>
```

## Step 6: Backend langgraph.json

Ensure `langgraph.json` has the auth path:
```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

If `langgraph.json` already exists, add the `"auth"` key. If not, create it.

## Step 7: Backend dependencies

Ensure `pyjwt` is installed:
```bash
pip install pyjwt
```

Or add to `requirements.txt` / `pyproject.toml`.

## Verification

- [ ] Frontend `NEXTAUTH_SECRET` matches backend `NEXTAUTH_SECRET`
- [ ] `NEXT_PUBLIC_API_URL` points to running LangGraph server
- [ ] Database initialized (`pnpm db:setup`)
- [ ] Backend `langgraph.json` has `auth.path`
- [ ] Backend `src/security/auth.py` exists
- [ ] `pyjwt` installed in backend

Start:
```bash
# Terminal 1: Frontend
cd frontend && pnpm dev

# Terminal 2: Backend
langgraph up
```
