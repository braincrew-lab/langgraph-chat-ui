# Authentication Architecture Overview

This document describes all 7 authentication modes supported by LangGraph Chat UI and how to choose the right mode for your use case.

## Quick Reference

| Mode | Frontend | Server Auth | Token Type | NextAuth | Per-User Isolation | Use Case |
|------|----------|-------------|------------|----------|-------------------|----------|
| **standalone** | None required | None | None | No | No | Local dev, demos |
| **credentials** | Next.js + form | NextAuth | JWT (HS256) | Yes | Yes | Traditional login |
| **oauth** | Next.js + OAuth | NextAuth | JWT (HS256) | Yes | Yes | Social login (Google/GitHub) |
| **email** | Next.js + form | NextAuth | JWT (HS256) | Yes | Yes | Magic link login |
| **oauth-direct** | Direct OAuth | Provider API calls | Provider token | No | Yes | CLI, mobile, no frontend |
| **custom-jwt** | None required | JWKS validation | JWT (RS256/ES256) | No | Yes | Keycloak, Auth0, Supabase |
| **api-key** | None required | LangGraph Cloud | API Key | No | No | LangGraph Cloud |

## Mode Selection Flowchart

```
START
  |
  +-- Have a Next.js frontend?
  |   |
  |   +-- YES
  |   |    |
  |   |    +-- What login method?
  |   |        |
  |   |        +-- OAuth (Google/GitHub) --> oauth
  |   |        +-- Email/password DB --> credentials
  |   |        +-- Magic link email --> email
  |   |
  |   +-- NO
  |        |
  |        +-- Have existing auth system?
  |        |   |
  |        |   +-- YES (Keycloak/Auth0/Supabase) --> custom-jwt
  |        |   +-- NO
  |        |        |
  |        |        +-- Need direct OAuth? --> oauth-direct
  |        |        +-- Using LangGraph Cloud? --> api-key
  |        |        +-- Local dev? --> standalone
  |
```

## Architecture Diagrams

### Standalone (No Auth)

```
Client --> LangGraph Server
          (no validation)
```

**Characteristics:**
- No authentication required
- All requests allowed
- No per-user thread isolation
- Best for: local development, public demos, internal testing

### Credentials & OAuth & Email (NextAuth)

```
Client --> Next.js Server --> LangGraph Server
           (issues JWT)      (validates JWT)
```

**Token Flow:**
1. Client logs in with NextAuth (credentials, OAuth, or email)
2. Next.js Server creates JWT token (HS256)
3. Client stores JWT in secure HTTP-only cookie
4. Client sends JWT in Authorization header to LangGraph
5. LangGraph verifies JWT signature (no DB call needed)

**Per-User Isolation:**
- Each request includes `owner` metadata with user identity
- LangGraph filters threads/data by owner

### OAuth-Direct

```
Client --> OAuth Provider (acquires token)
           |
           +-> LangGraph Server (validates with provider API)
```

**Token Flow:**
1. Client acquires OAuth token directly from provider (Google, GitHub, etc.)
2. Client sends OAuth token to LangGraph
3. LangGraph calls provider's userinfo API to validate token
4. Provider returns user information

**Pros:**
- Works without Next.js frontend
- Supports CLI, mobile, desktop apps

**Cons:**
- One API call to provider per request
- Subject to provider rate limits
- Manual per-provider implementation

### Custom-JWT (OIDC with JWKS)

```
Client --> IdP (acquires JWT)
           |
           +-> LangGraph Server (validates with JWKS public keys)
```

**Token Flow:**
1. Client acquires JWT from external IdP (Keycloak, Auth0, Supabase, Okta)
2. Client sends JWT in Authorization header to LangGraph
3. LangGraph fetches public keys from IdP's JWKS endpoint (cached)
4. LangGraph verifies JWT signature cryptographically
5. No IdP API call needed (JWKS is cached)

**Pros:**
- Standards-based (OIDC)
- Fast verification (no API calls after JWKS cached)
- Works without Next.js
- Supports multiple providers

**Cons:**
- Requires external IdP
- Initial setup more complex

### API-Key (LangGraph Cloud)

```
Client --> LangGraph Cloud
           (validates API key natively)
```

**Characteristics:**
- LangGraph Cloud validates API key natively
- No custom auth handler needed
- Only requires `x-api-key` header
- Simplest deployment (no auth.py required)

## Environment Variables Reference

### standalone
```env
# Frontend
NEXT_PUBLIC_AUTH_MODE=standalone
NEXT_PUBLIC_API_URL=http://localhost:2024

# Server
# No auth configuration needed
```

### credentials
```env
# Frontend
NEXT_PUBLIC_AUTH_MODE=credentials
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
DATABASE_URL=file:./prisma/dev.db

# Server
NEXTAUTH_SECRET=your-nextauth-secret
# Must match frontend NEXTAUTH_SECRET
```

### oauth (Google/GitHub)
```env
# Frontend
NEXT_PUBLIC_AUTH_MODE=oauth
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
DATABASE_URL=file:./prisma/dev.db
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Server
NEXTAUTH_SECRET=your-nextauth-secret
```

### email (Magic Link)
```env
# Frontend
NEXT_PUBLIC_AUTH_MODE=email
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
DATABASE_URL=file:./prisma/dev.db
EMAIL_SERVER_HOST=smtp.example.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@example.com
EMAIL_SERVER_PASSWORD=your-password
EMAIL_FROM=noreply@example.com

# Server
NEXTAUTH_SECRET=your-nextauth-secret
```

### oauth-direct
```env
# Frontend
NEXT_PUBLIC_AUTH_MODE=oauth-direct
NEXT_PUBLIC_API_URL=http://localhost:2024
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com

# Server
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
# No NextAuth configuration needed
```

### custom-jwt
```env
# Frontend (if using web UI)
NEXT_PUBLIC_AUTH_MODE=custom-jwt
NEXT_PUBLIC_API_URL=http://localhost:2024

# Server
JWT_JWKS_URI=https://your-idp/.well-known/jwks.json
JWT_ISSUER=https://your-idp/realms/your-realm  # optional
JWT_AUDIENCE=your-client-id                     # optional
```

### api-key
```env
# Frontend (if using web UI)
NEXT_PUBLIC_AUTH_MODE=api-key
NEXT_PUBLIC_API_URL=http://localhost:2024

# Server
# No custom auth needed
# LangGraph Cloud validates API key natively
```

## LangGraph Server auth.py Pattern

All modes except `standalone` and `api-key` require an `auth.py` handler:

### langgraph.json
```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

### Minimal auth.py Structure
```python
import os
from langgraph_sdk import Auth

auth = Auth()

@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Extract and validate user identity from authorization header."""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")
    
    # Parse authorization header and validate token
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")
    
    # Verify token (mode-specific: JWT decode, JWKS validation, API call, etc.)
    # Return user identity
    return {
        "identity": user_id,
        "email": user_email,
    }

@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Isolate threads per user."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

## MinimalUserDict Interface

The `@auth.authenticate` handler must return a dict with at least:

```python
{
    "identity": str,          # Required: unique user identifier
    "email": str,             # Optional: user email
    "display_name": str,      # Optional: user display name
    "is_authenticated": bool, # Optional: auth status
    # ... other custom fields
}
```

**Key Points:**
- `identity` must be globally unique (user ID, email, or identifier from provider)
- `identity` is used for per-user thread isolation via `owner` metadata
- Additional fields are stored in user dict and available in auth context

## Decision Matrix

Choose your mode based on these questions:

| Question | Answer | Mode |
|----------|--------|------|
| Do you have a Next.js frontend? | Yes | oauth / credentials / email |
| Do you have a Next.js frontend? | No | custom-jwt / oauth-direct / api-key |
| Do you have an existing auth system? | Yes (Keycloak/Auth0/etc) | custom-jwt |
| Do you need to isolate threads per user? | Yes | credentials / oauth / email / oauth-direct / custom-jwt |
| Do you need to isolate threads per user? | No | standalone / api-key |
| Are you using LangGraph Cloud? | Yes | api-key |
| Is this local development? | Yes | standalone |

## Common Errors

### JWT Secret Mismatch
**Problem:** 401 errors on every request in credentials/oauth/email modes

**Solution:** Ensure `NEXTAUTH_SECRET` is identical on frontend and server:
```bash
# Both must be the same value
echo $NEXTAUTH_SECRET  # Frontend
echo $NEXTAUTH_SECRET  # Server (verify they match)
```

### Missing JWKS Endpoint
**Problem:** 401 errors in custom-jwt mode with "Unable to find signing key"

**Solution:** Verify `JWT_JWKS_URI` is accessible:
```bash
curl https://your-idp/.well-known/jwks.json
# Should return JSON with "keys" array
```

### Identity Not Isolated
**Problem:** Users can see other users' threads

**Solution:** Verify `owner` metadata is set:
```python
@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity  # Must set owner
    return {"owner": ctx.user.identity}
```

## Next Steps

- [Credentials Mode](./02-NEXTAUTH-CREDENTIALS.md)
- [OAuth Mode](./01-NEXTAUTH-OAUTH.md)
- [Email Mode](./03-NEXTAUTH-EMAIL.md)
- [OAuth-Direct Mode](./04-OAUTH-DIRECT.md)
- [Custom-JWT Mode](./06-CUSTOM-JWT.md)
- [API-Key Mode](./07-API-KEY.md)
- [Custom Server Auth](./08-CUSTOM-SERVER-AUTH.md)
