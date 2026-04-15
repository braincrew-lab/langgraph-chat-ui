# Your First Custom LangGraph Server Authentication

This tutorial walks you through creating a custom authentication handler for LangGraph. By the end, you'll understand the `Auth()` contract, `MinimalUserDict` interface, and per-user thread isolation via owner metadata.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [What We're Building](#what-were-building)
3. [The Auth() Contract](#the-auth-contract)
4. [MinimalUserDict Interface](#minimaluserdict-interface)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [Testing Your Auth Handler](#testing-your-auth-handler)
7. [Advanced Patterns](#advanced-patterns)
8. [Common Mistakes](#common-mistakes)

---

## Prerequisites

- Python 3.11+
- LangGraph installed: `pip install langgraph`
- Basic understanding of async/await
- A way to generate test tokens (JWT, OAuth tokens, etc.)

---

## What We're Building

A custom authentication handler that:

1. Extracts a token from the `Authorization: Bearer <token>` header
2. Validates the token (method varies by mode)
3. Returns user identity and metadata
4. Isolates threads per user via `owner` metadata

### The Handler Must Do Three Things

```python
@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """
    ✓ Parse the Authorization header
    ✓ Validate the token (your logic here)
    ✓ Return user identity dict
    """

@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """
    ✓ Extract user identity from auth context
    ✓ Add 'owner' metadata to filter by user
    ✓ Return filter dict for thread isolation
    """
```

---

## The Auth() Contract

LangGraph provides the `Auth` class to define authentication rules.

### Import and Initialize

```python
from langgraph_sdk import Auth

auth = Auth()
```

### @auth.authenticate Decorator

The function decorated with `@auth.authenticate` is called for every request:

```python
@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """
    Args:
        authorization: The value of the 'Authorization' HTTP header.
                      Format: "Bearer <token>" or None if missing.

    Returns:
        A MinimalUserDict with at least 'identity' key.

    Raises:
        Auth.exceptions.HTTPException: If auth fails (401, 403, etc.)
    """
    pass
```

**Important:**
- Called on EVERY request
- Synchronous or async
- Must raise `HTTPException` on failure, not return None
- Must return MinimalUserDict on success

### @auth.on Decorator

The function decorated with `@auth.on` is called when resources are created/accessed:

```python
@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """
    Args:
        ctx: Authentication context (includes validated user from @auth.authenticate)
        value: The resource being created (dict)

    Returns:
        Filter dict to apply for resource isolation
    """
    pass
```

**Important:**
- Called when creating/accessing threads, runs, etc.
- Modifies the resource to add owner metadata
- Returns filter dict for querying

---

## MinimalUserDict Interface

The `@auth.authenticate` handler must return a dict with at least this structure:

```python
{
    "identity": "user-123",           # Required: unique user identifier
    "email": "user@example.com",      # Optional: user email
    "display_name": "John Doe",       # Optional: human-readable name
    "is_authenticated": True,          # Optional: auth status flag
    # ... any other custom fields
}
```

### Key Constraints

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `identity` | `str` | **Yes** | Must be globally unique per user. Used for thread isolation. Examples: user ID, email, `provider:user-id` |
| `email` | `str` | No | User's email address |
| `display_name` | `str` | No | Human-readable name for logging/UI |
| `is_authenticated` | `bool` | No | Redundant (presence in dict implies authenticated), but allowed |
| Custom fields | Any | No | Add any fields; accessible in `ctx.user.get()` |

### Examples

```python
# Minimal
return {"identity": "user-123"}

# With metadata
return {
    "identity": "user-123",
    "email": "user@example.com",
    "display_name": "John Doe",
    "is_authenticated": True,
}

# With custom fields
return {
    "identity": "google:118346091823908",
    "email": "user@gmail.com",
    "display_name": "John Doe",
    "provider": "google",
    "roles": ["user", "admin"],
}
```

---

## Step-by-Step Implementation

### Step 1: Create langgraph.json

Tell LangGraph where to find your auth handler:

```json
{
  "define": "src/graph.py:graph",
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

### Step 2: Create src/security/auth.py

Start with a basic structure:

```python
"""Authentication handler for LangGraph.

This module defines how to validate incoming requests and isolate
resources per user.
"""

import os
from langgraph_sdk import Auth

# Your auth configuration (load from env vars)
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")

auth = Auth()


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate incoming request and return user identity.

    Args:
        authorization: Authorization header value (e.g., "Bearer <token>")

    Returns:
        User identity dict

    Raises:
        HTTPException: If authorization fails
    """
    # Placeholder: we'll add validation logic next
    raise Auth.exceptions.HTTPException(
        status_code=401,
        detail="Not implemented"
    )


@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Add owner metadata for per-user isolation.

    Args:
        ctx: Auth context (includes validated user)
        value: Resource being created

    Returns:
        Filter dict for resource isolation
    """
    # Extract user identity from auth context
    filters = {"owner": ctx.user.identity}

    # Add to resource metadata
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)

    return filters
```

### Step 3: Implement Token Validation

Add your specific validation logic. Here are common patterns:

#### Pattern A: JWT Token (HS256)

```python
import jwt

@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate JWT token."""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    # Parse "Bearer <token>"
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    try:
        # Decode JWT with secret key
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

        return {
            "identity": payload["sub"],
            "email": payload.get("email"),
            "display_name": payload.get("name"),
        }
    except jwt.InvalidTokenError as e:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail=f"Invalid token: {e}"
        )
```

#### Pattern B: JWKS Validation (RS256)

```python
from jwt import PyJWKClient
import jwt

JWKS_URL = os.environ["JWT_JWKS_URI"]
jwks_client = PyJWKClient(JWKS_URL, cache_jwk_set=True, lifespan=3600)

@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate JWT with JWKS public key."""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    try:
        # Get public key from JWKS endpoint
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Verify signature with public key
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=os.environ.get("JWT_ISSUER"),
            audience=os.environ.get("JWT_AUDIENCE"),
        )

        return {
            "identity": payload["sub"],
            "email": payload.get("email"),
        }
    except jwt.InvalidTokenError as e:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail=f"Invalid token: {e}"
        )
```

#### Pattern C: API Key

```python
@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate simple API key."""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    # Expect "Bearer <api-key>"
    scheme, _, api_key = authorization.partition(" ")
    if scheme.lower() != "bearer" or not api_key:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid format")

    # Check against allowed keys
    VALID_KEYS = {"sk-test-123", "sk-test-456"}
    if api_key not in VALID_KEYS:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid key")

    return {
        "identity": f"api-key:{api_key[:10]}",
        "display_name": "API User",
    }
```

### Step 4: Per-User Isolation

The `@auth.on` handler ensures each user's threads are isolated:

```python
@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Isolate resources per authenticated user.

    This function is called when creating/accessing threads, runs, etc.
    It adds 'owner' metadata to automatically filter by user.
    """
    # Get user identity from auth context
    user_identity = ctx.user.identity

    # Create filter dict
    filters = {"owner": user_identity}

    # Add to resource metadata (threads/runs/etc.)
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = user_identity

    return filters
```

### Step 5: Complete Implementation Example

```python
"""Authentication handler for LangGraph.

Validates JWT tokens (HS256) and isolates resources per user.
"""

import os
import jwt
from langgraph_sdk import Auth

SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate JWT token and extract user identity.

    Args:
        authorization: Authorization header (e.g., "Bearer <token>")

    Returns:
        User identity dict

    Raises:
        HTTPException: If token is invalid
    """
    if not authorization:
        raise AUTH_EXCEPTION

    try:
        # Parse "Bearer <token>"
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        # Decode JWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

        # Return user identity
        return {
            "identity": payload["sub"],
            "email": payload.get("email"),
            "display_name": payload.get("name"),
            "is_authenticated": True,
        }

    except (ValueError, jwt.InvalidTokenError) as e:
        raise AUTH_EXCEPTION from e


@auth.on
async def add_owner_metadata(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Add owner metadata to resources for per-user isolation.

    Ensures users can only access their own threads and runs.
    """
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

---

## Testing Your Auth Handler

### Test 1: Verify Auth Handler Loads

```bash
# Start LangGraph server
langgraph up

# Check if auth handler loaded (no errors)
# Should see in logs: "Auth handler loaded"
```

### Test 2: Test Without Token (Should Fail)

```bash
curl -X POST http://localhost:2024/runs \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

# Expected: 401 Unauthorized
```

### Test 3: Test With Invalid Token (Should Fail)

```bash
curl -X POST http://localhost:2024/runs \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v

# Expected: 401 Unauthorized
```

### Test 4: Generate Valid Test Token

```python
import jwt
import json

SECRET_KEY = "dev-secret"

token = jwt.encode(
    {
        "sub": "user-123",
        "email": "user@example.com",
        "name": "Test User",
    },
    SECRET_KEY,
    algorithm="HS256"
)

print(f"Token: {token}")
```

### Test 5: Test With Valid Token (Should Succeed)

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:2024/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": []}
  }' \
  -v

# Expected: 200 OK or streaming response
```

### Test 6: Verify Per-User Isolation

Create two users and verify they can't see each other's threads:

```python
import jwt
from langgraph_sdk import get_client

SECRET_KEY = "dev-secret"

# User 1 token
token1 = jwt.encode({"sub": "user-1", "email": "user1@example.com"}, SECRET_KEY)

# User 2 token
token2 = jwt.encode({"sub": "user-2", "email": "user2@example.com"}, SECRET_KEY)

# Create clients
client1 = get_client(
    url="http://localhost:2024",
    headers={"Authorization": f"Bearer {token1}"}
)

client2 = get_client(
    url="http://localhost:2024",
    headers={"Authorization": f"Bearer {token2}"}
)

# User 1 creates thread
thread1 = await client1.threads.create()
print(f"User 1 thread: {thread1['thread_id']}")

# User 2 creates thread
thread2 = await client2.threads.create()
print(f"User 2 thread: {thread2['thread_id']}")

# User 2 tries to access User 1's thread
try:
    await client2.threads.get(thread1['thread_id'])
    print("ERROR: User 2 should not see User 1's thread!")
except Exception as e:
    print(f"GOOD: User 2 cannot access User 1's thread: {e}")
```

---

## Advanced Patterns

### Pattern: Multi-Provider Identities

When supporting multiple auth providers, prefix identity with provider:

```python
@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Support multiple providers."""
    # ... token validation ...

    provider = detect_provider(token)  # your logic
    user_id = extract_user_id(token)   # your logic

    return {
        "identity": f"{provider}:{user_id}",
        "provider": provider,
    }
```

### Pattern: Role-Based Access Control

Add roles to user dict for permission checks in your application:

```python
@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Include user roles in auth response."""
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

    return {
        "identity": payload["sub"],
        "roles": payload.get("roles", []),  # ["user", "admin"]
    }

# In your graph code, access roles:
@auth.on
async def check_permissions(ctx: Auth.types.AuthContext, value: dict) -> dict:
    if "admin" not in ctx.user.get("roles", []):
        raise Auth.exceptions.HTTPException(status_code=403, detail="Forbidden")
```

### Pattern: Token Caching for Performance

Cache token validation results to avoid repeated decryption:

```python
import hashlib
import time

_token_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 300  # 5 minutes


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Cache token validation for performance."""
    scheme, _, token = authorization.partition(" ")

    # Check cache
    cache_key = hashlib.sha256(token.encode()).hexdigest()
    if cache_key in _token_cache:
        user_info, cached_at = _token_cache[cache_key]
        if time.time() - cached_at < CACHE_TTL:
            return user_info

    # Validate token
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    user_info = {"identity": payload["sub"]}

    # Cache result
    _token_cache[cache_key] = (user_info, time.time())

    return user_info
```

---

## Common Mistakes

### Mistake 1: Returning None Instead of Raising Exception

```python
# WRONG
@auth.authenticate
async def authenticate(authorization):
    if not authorization:
        return None  # Will cause errors!

# CORRECT
@auth.authenticate
async def authenticate(authorization):
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")
```

### Mistake 2: Missing "identity" Field

```python
# WRONG
return {
    "email": "user@example.com",
    "display_name": "John",
    # Missing "identity"!
}

# CORRECT
return {
    "identity": "user-123",  # Must include
    "email": "user@example.com",
    "display_name": "John",
}
```

### Mistake 3: Not Adding Owner Metadata

```python
# WRONG: threads won't be isolated
@auth.on
async def filter_by_owner(ctx, value):
    return {}  # Empty filter!

# CORRECT: include owner in metadata
@auth.on
async def filter_by_owner(ctx, value):
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

### Mistake 4: Exposing Secrets in Error Messages

```python
# WRONG
except jwt.InvalidTokenError as e:
    raise Auth.exceptions.HTTPException(
        status_code=401,
        detail=f"Token invalid, SECRET_KEY is {SECRET_KEY}"  # Exposes secret!
    )

# CORRECT
except jwt.InvalidTokenError:
    raise Auth.exceptions.HTTPException(
        status_code=401,
        detail="Invalid token"  # Generic message
    )
```

### Mistake 5: Synchronous I/O in Async Handler

```python
# WRONG: blocks event loop
@auth.authenticate
async def authenticate(authorization):
    response = requests.get("https://api.example.com/user")  # Blocks!

# CORRECT: use async HTTP client
@auth.authenticate
async def authenticate(authorization):
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/user")
```

---

## Next Steps

Now that you understand the auth handler contract:

- [Custom JWT Mode](./06-CUSTOM-JWT.md) - Full implementation for external IdPs
- [OAuth Direct Mode](./04-OAUTH-DIRECT.md) - Validating OAuth provider tokens
- [Auth Architecture](./05-AUTH-ARCHITECTURE.md) - Compare all 7 auth modes
- [LangGraph Auth Docs](https://langchain-ai.github.io/langgraph/cloud/concepts/auth/)

---

## Troubleshooting

### Auth handler not loading

Check `langgraph.json` path is correct:
```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

### TypeError: 'NoneType' object is not subscriptable

Your `@auth.authenticate` returned None instead of raising an exception. Fix:
```python
if not authorization:
    raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")
```

### 401 on valid token

Check token validation logic:
- Decode token without verification to inspect claims: `jwt.decode(token, options={"verify_signature": False})`
- Verify `identity` field is present in returned dict
- Check token expiry: `payload.get("exp")`

### Threads visible across users

Check `@auth.on` is setting owner metadata:
```python
metadata = value.setdefault("metadata", {})
metadata["owner"] = ctx.user.identity  # Must set!
return {"owner": ctx.user.identity}
```
