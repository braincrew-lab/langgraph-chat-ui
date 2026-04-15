# OAuth Direct Mode Setup

LangGraph server handles OAuth directly by validating provider tokens via the provider's API. No NextAuth, no database needed on the frontend side.

## Frontend .env

Write to `frontend/.env`:
```env
AUTH_MODE=oauth-direct
NEXT_PUBLIC_AUTH_MODE=oauth-direct
NEXT_PUBLIC_API_URL=<langgraph-server-url>
```

No `DATABASE_URL` or `NEXTAUTH_SECRET` needed.

## Backend auth.py

Create `src/security/auth.py` in the backend server directory:

```python
"""Authentication handler for LangGraph (OAuth Direct).

Validates OAuth provider tokens by calling the provider's userinfo API.
No JWT secret needed — validation is done via HTTPS to the provider.

Environment variables:
- (none required — provider APIs are public)
"""

import httpx
from langgraph_sdk import Auth

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)

# Provider userinfo endpoints
PROVIDER_ENDPOINTS = {
    "google": "https://www.googleapis.com/oauth2/v3/userinfo",
    "github": "https://api.github.com/user",
}


async def _validate_with_provider(token: str) -> dict | None:
    """Try each provider's userinfo endpoint until one succeeds."""
    async with httpx.AsyncClient() as client:
        # Try Google
        resp = await client.get(
            PROVIDER_ENDPOINTS["google"],
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            info = resp.json()
            return {
                "identity": f"google:{info['sub']}",
                "email": info.get("email"),
                "display_name": info.get("name"),
            }

        # Try GitHub
        resp = await client.get(
            PROVIDER_ENDPOINTS["github"],
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            info = resp.json()
            return {
                "identity": f"github:{info['id']}",
                "email": info.get("email"),
                "display_name": info.get("name") or info.get("login"),
            }

    return None


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate OAuth provider token via provider API."""
    if not authorization:
        raise AUTH_EXCEPTION

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        user = await _validate_with_provider(token)
        if not user:
            raise AUTH_EXCEPTION

        return {**user, "is_authenticated": True}

    except ValueError:
        raise AUTH_EXCEPTION


@auth.on
async def add_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Isolate threads per user."""
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

## Backend langgraph.json

```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

## Backend dependencies

```bash
pip install httpx
```

## Verification

- [ ] Frontend `.env` has `AUTH_MODE=oauth-direct`
- [ ] `NEXT_PUBLIC_API_URL` points to LangGraph server
- [ ] Backend `src/security/auth.py` exists with provider validation
- [ ] `httpx` installed in backend
- [ ] No `NEXTAUTH_SECRET` needed
