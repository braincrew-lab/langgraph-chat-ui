# Custom JWT Mode Setup (External IdP with JWKS)

Uses an external Identity Provider (Keycloak, Auth0, Supabase, Okta) that issues OIDC-compliant JWT tokens. LangGraph validates tokens by fetching public keys from the IdP's JWKS endpoint.

## Frontend .env

Write to `frontend/.env`:
```env
AUTH_MODE=custom-jwt
NEXT_PUBLIC_AUTH_MODE=custom-jwt
NEXT_PUBLIC_API_URL=<langgraph-server-url>
```

No `DATABASE_URL` or `NEXTAUTH_SECRET` needed.

## Backend auth.py

Create `src/security/auth.py` in the backend server directory:

```python
"""Authentication handler for LangGraph (Custom JWT with JWKS).

Validates JWT tokens issued by an external Identity Provider using
JWKS (JSON Web Key Set) public key verification.

Environment variables:
- JWT_JWKS_URI: JWKS endpoint URL (required)
- JWT_ISSUER: Expected token issuer (optional, recommended)
- JWT_AUDIENCE: Expected token audience (optional, recommended)
"""

import os

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError
from langgraph_sdk import Auth

JWKS_URI = os.environ["JWT_JWKS_URI"]
ISSUER = os.environ.get("JWT_ISSUER")
AUDIENCE = os.environ.get("JWT_AUDIENCE")

jwks_client = PyJWKClient(JWKS_URI, cache_jwk_set=True, lifespan=3600)

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Validate external IdP JWT using JWKS public key."""
    if not authorization:
        raise AUTH_EXCEPTION

    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=ISSUER if ISSUER else None,
            audience=AUDIENCE if AUDIENCE else None,
        )

        user_id = payload.get("sub")
        if not user_id:
            raise AUTH_EXCEPTION

        return {
            "identity": user_id,
            "display_name": payload.get("name") or payload.get("preferred_username"),
            "email": payload.get("email"),
            "is_authenticated": True,
        }

    except (ValueError, InvalidTokenError):
        raise AUTH_EXCEPTION


@auth.on
async def add_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Isolate threads per user."""
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

## Backend .env

```env
JWT_JWKS_URI=<jwks-endpoint-url>
JWT_ISSUER=<issuer-url>          # optional but recommended
JWT_AUDIENCE=<audience>          # optional but recommended
```

### Common IdP configurations:

**Keycloak:**
```env
JWT_JWKS_URI=https://keycloak.example.com/realms/{realm}/protocol/openid-connect/certs
JWT_ISSUER=https://keycloak.example.com/realms/{realm}
JWT_AUDIENCE=your-client-id
```

**Auth0:**
```env
JWT_JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
JWT_ISSUER=https://your-tenant.auth0.com/
JWT_AUDIENCE=https://your-api-identifier
```

**Supabase:**
```env
JWT_JWKS_URI=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
JWT_ISSUER=https://your-project.supabase.co/auth/v1
JWT_AUDIENCE=authenticated
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
pip install "pyjwt[crypto]"
```

The `[crypto]` extra is required for RSA/ECDSA key validation.

## Verification

- [ ] Frontend `.env` has `AUTH_MODE=custom-jwt`
- [ ] Backend `JWT_JWKS_URI` is accessible: `curl $JWT_JWKS_URI | jq '.keys | length'`
- [ ] Backend `src/security/auth.py` exists with JWKS validation
- [ ] `pyjwt[crypto]` installed in backend
- [ ] `langgraph.json` has `auth.path`
