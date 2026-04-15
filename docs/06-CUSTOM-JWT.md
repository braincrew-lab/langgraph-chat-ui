# Custom JWT Authentication with OIDC & JWKS

This guide explains how to set up authentication using an external Identity Provider (IdP) that issues OIDC-compliant JWT tokens. LangGraph validates these tokens by fetching public keys from the IdP's JWKS (JSON Web Key Set) endpoint.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Supported Identity Providers](#supported-identity-providers)
3. [Environment Variables](#environment-variables)
4. [Server-Side Setup](#server-side-setup)
5. [OIDC Authorization Code Flow](#oidc-authorization-code-flow-with-pkce)
6. [Provider-Specific Setup](#provider-specific-setup)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client
    participant IdP as Identity Provider<br/>(Keycloak/Auth0/Supabase)
    participant LangGraph as LangGraph Server
    participant JWKS as IdP JWKS Endpoint

    rect rgb(240, 248, 255)
        Note over Client,IdP: Step 1: OIDC Authorization Code Flow
        Client->>IdP: Authorization request + PKCE challenge
        IdP->>IdP: User authentication + consent
        IdP-->>Client: Authorization code + state
        Client->>IdP: Exchange code for tokens
        IdP-->>Client: JWT (access_token) + refresh_token
    end

    rect rgb(255, 248, 240)
        Note over Client,JWKS: Step 2: Token Verification
        Client->>LangGraph: API request + Authorization: Bearer JWT
        LangGraph->>JWKS: Fetch public keys (first time)
        JWKS-->>LangGraph: { keys: [{ kid, n, e, ... }] }
        LangGraph->>LangGraph: Cache JWKS for 1 hour
        LangGraph->>LangGraph: Verify JWT signature (RS256)
        LangGraph->>LangGraph: Verify issuer, audience, expiry
        LangGraph-->>Client: Response (authenticated)
    end

    rect rgb(255, 240, 240)
        Note over Client,LangGraph: Subsequent requests: Cache hit
        Client->>LangGraph: API request + JWT
        LangGraph->>LangGraph: Verify using cached JWKS
        LangGraph-->>Client: Response (fast!)
    end
```

### Key Characteristics

| Item | Description |
|------|-------------|
| **Token Issuer** | External IdP (Keycloak, Auth0, Supabase, Okta) |
| **Token Verification** | JWKS public key validation (no API calls after cached) |
| **Frontend** | Not required (can be CLI, mobile, or custom) |
| **Token Algorithm** | RS256 (RSA) or ES256 (ECDSA) |
| **Key Caching** | Automatic, 1-hour lifespan |

### Pros and Cons

**Pros:**
- Standards-based (OIDC)
- Fast verification (JWKS cached, no per-request API calls)
- Works without Next.js frontend
- No custom OAuth integration per provider
- One implementation supports Keycloak, Auth0, Supabase, Okta, etc.

**Cons:**
- Requires external IdP
- Initial IdP setup more complex than email/password
- Clients must implement OIDC flow (or use SDK)

---

## Supported Identity Providers

All providers that support OIDC and expose a `.well-known/openid-configuration` endpoint are supported:

- **Keycloak** (open-source)
- **Auth0** (SaaS)
- **Supabase** (SaaS, PostgreSQL-based)
- **Okta** (enterprise)
- **Azure AD** (enterprise)
- **Google Identity** (enterprise)
- Any OIDC-compliant provider

---

## Environment Variables

### Required

```env
JWT_JWKS_URI=https://your-idp.example.com/.well-known/jwks.json
```

The JWKS endpoint URL. Typically found in the IdP's `.well-known/openid-configuration`.

### Optional

```env
# Token validation constraints (enforce specific IdP/audience)
JWT_ISSUER=https://your-idp.example.com/realms/your-realm
JWT_AUDIENCE=your-client-id
```

### Example: Keycloak
```env
JWT_JWKS_URI=https://keycloak.example.com/realms/my-realm/protocol/openid-connect/certs
JWT_ISSUER=https://keycloak.example.com/realms/my-realm
JWT_AUDIENCE=my-client
```

### Example: Auth0
```env
JWT_JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
JWT_ISSUER=https://your-tenant.auth0.com/
JWT_AUDIENCE=https://your-api-identifier
```

### Example: Supabase
```env
JWT_JWKS_URI=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
JWT_ISSUER=https://your-project.supabase.co/auth/v1
JWT_AUDIENCE=authenticated
```

---

## Server-Side Setup

### Step 1: Configure langgraph.json

```json
{
  "auth": {
    "path": "src/security/auth.py:auth"
  }
}
```

### Step 2: Create src/security/auth.py

```python
"""Authentication handler for Custom JWT mode (JWKS-based validation).

This module validates JWT tokens issued by an external Identity Provider
(e.g., Keycloak, Auth0, Supabase, Okta) using JWKS public key verification.

Environment variables:
- JWT_JWKS_URI: JWKS endpoint URL
- JWT_ISSUER: Expected token issuer (optional)
- JWT_AUDIENCE: Expected token audience (optional)
"""

import os

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError
from langgraph_sdk import Auth

# External IdP configuration
JWKS_URI = os.environ["JWT_JWKS_URI"]
ISSUER = os.environ.get("JWT_ISSUER")
AUDIENCE = os.environ.get("JWT_AUDIENCE")

# Initialize JWKS client with caching (auto-refreshes on key rotation)
jwks_client = PyJWKClient(JWKS_URI, cache_jwk_set=True, lifespan=3600)

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Invalid or expired token",
    headers={"WWW-Authenticate": "Bearer"},
)


@auth.authenticate
async def get_current_user(
    authorization: str | None,
) -> Auth.types.MinimalUserDict:
    """Validate external IdP JWT token using JWKS public key.

    Args:
        authorization: The Authorization header value (Bearer <token>)

    Returns:
        User information dict with identity and metadata

    Raises:
        HTTPException: If token is invalid or expired
    """
    if not authorization:
        raise AUTH_EXCEPTION

    try:
        # Extract token from "Bearer <token>" format
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        # Get the signing key from JWKS endpoint
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and validate the JWT token with public key
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=ISSUER if ISSUER else None,
            audience=AUDIENCE if AUDIENCE else None,
        )

        # Extract user info from standard OIDC claims
        user_id = payload.get("sub")
        if not user_id:
            raise AUTH_EXCEPTION

        return {
            "identity": user_id,
            "display_name": payload.get("name") or payload.get("preferred_username"),
            "email": payload.get("email"),
            "is_authenticated": True,
        }

    except (ValueError, InvalidTokenError) as e:
        raise AUTH_EXCEPTION from e


@auth.on
async def add_owner(
    ctx: Auth.types.AuthContext,
    value: dict,
):
    """Add owner metadata to resources for per-user isolation.

    This ensures that users can only access their own threads and data.
    """
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
```

### Step 3: Install Dependencies

```bash
pip install pyjwt[crypto]
```

The `[crypto]` extra is required for RSA key validation.

---

## OIDC Authorization Code Flow with PKCE

If you need to implement a client-side login flow, follow the Authorization Code flow with PKCE:

### Flow Diagram

```
1. Client generates PKCE challenge:
   - code_verifier = random(128 bytes)
   - code_challenge = SHA256(code_verifier) base64-url-encoded

2. Client redirects to IdP:
   - GET /oauth/authorize
   - client_id=your-client-id
   - redirect_uri=http://localhost:3000/callback
   - scope=openid profile email
   - response_type=code
   - code_challenge=<challenge>
   - code_challenge_method=S256

3. User authenticates at IdP

4. IdP redirects back to client with authorization code:
   - http://localhost:3000/callback?code=<code>&state=<state>

5. Client exchanges code for tokens:
   - POST /oauth/token
   - code=<code>
   - client_id=your-client-id
   - client_secret=your-client-secret
   - code_verifier=<verifier>
   - grant_type=authorization_code

6. IdP returns tokens:
   {
     "access_token": "eyJhbGc...",
     "refresh_token": "...",
     "expires_in": 3600,
     "token_type": "Bearer"
   }

7. Client stores access_token (in memory or secure storage)

8. Client sends JWT with API requests:
   - Authorization: Bearer <access_token>
```

### Client Implementation (Python)

```python
from langgraph_sdk import get_client

# Access Token obtained from IdP
jwt_token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."

client = get_client(
    url="http://localhost:2024",
    headers={"Authorization": f"Bearer {jwt_token}"}
)

# Create thread and make requests
thread = await client.threads.create()
```

### Client Implementation (cURL)

```bash
curl -X POST http://localhost:2024/runs \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "Hello"}]}
  }'
```

---

## Provider-Specific Setup

### Keycloak

**Prerequisites:** Keycloak instance running (local or cloud)

#### Step 1: Create Client

1. Login to Keycloak Admin Console
2. Select your realm
3. Clients → Create client
4. Set Name: `my-langgraph-app`
5. Click Next → Next → Create

#### Step 2: Configure Client

1. Settings tab:
   - Client Authentication: **ON**
   - Valid Redirect URIs: `http://localhost:3000/callback` (if using web UI)
   - Web Origins: `http://localhost:3000`

2. Credentials tab:
   - Note the **Client Secret**

3. Client Scopes:
   - Ensure `profile`, `email`, `openid` are included

#### Step 3: Get JWKS URI

Visit: `https://keycloak.example.com/realms/your-realm/.well-known/openid-configuration`

Look for: `"jwks_uri": "https://keycloak.example.com/realms/your-realm/protocol/openid-connect/certs"`

#### Step 4: Environment Variables

```env
JWT_JWKS_URI=https://keycloak.example.com/realms/your-realm/protocol/openid-connect/certs
JWT_ISSUER=https://keycloak.example.com/realms/your-realm
JWT_AUDIENCE=my-langgraph-app
```

#### Step 5: Verify

```bash
curl https://keycloak.example.com/realms/your-realm/.well-known/openid-configuration \
  | jq '.jwks_uri'
```

---

### Auth0

**Prerequisites:** Auth0 account (https://auth0.com)

#### Step 1: Create Application

1. Dashboard → Applications → Create Application
2. Name: `LangGraph App`
3. Type: **Regular Web Application** (or API if headless)
4. Click Create

#### Step 2: Configure Application

1. Settings tab:
   - Allowed Callback URLs: `http://localhost:3000/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`

2. API Authorization:
   - Go to APIs → Create API
   - Name: `langgraph-api`
   - Identifier: `https://your-api-identifier` (used as audience)

#### Step 3: Get Configuration

Visit: `https://your-tenant.auth0.com/.well-known/openid-configuration`

Note the `jwks_uri` value.

#### Step 4: Environment Variables

```env
JWT_JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
JWT_ISSUER=https://your-tenant.auth0.com/
JWT_AUDIENCE=https://your-api-identifier
```

#### Step 5: Verify

```bash
curl https://your-tenant.auth0.com/.well-known/openid-configuration \
  | jq '.jwks_uri'
```

---

### Supabase

**Prerequisites:** Supabase project (https://supabase.com)

#### Step 1: Your Project Credentials

1. Login to Supabase Dashboard
2. Select your project
3. Settings → API → Project URL and anon/service keys

Your project URL is your IdP endpoint.

#### Step 2: Authentication Configuration

Supabase has OIDC built-in. No additional setup needed.

#### Step 3: Environment Variables

```env
JWT_JWKS_URI=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
JWT_ISSUER=https://your-project.supabase.co/auth/v1
JWT_AUDIENCE=authenticated
```

#### Step 4: Verify

```bash
curl https://your-project.supabase.co/auth/v1/.well-known/jwks.json \
  | jq '.keys | length'
# Should return number of keys (e.g., 2)
```

---

## Testing

### Test 1: Verify JWKS Endpoint

```bash
# Check if JWKS endpoint is accessible
curl $JWT_JWKS_URI | jq '.keys[0]'

# Should return:
# {
#   "kty": "RSA",
#   "kid": "...",
#   "use": "sig",
#   "n": "...",
#   "e": "AQAB"
# }
```

### Test 2: Obtain a Test Token

Using your IdP's test tools or a client library:

```bash
# Example for Keycloak:
curl -X POST https://keycloak.example.com/realms/my-realm/protocol/openid-connect/token \
  -d "client_id=my-langgraph-app" \
  -d "client_secret=your-secret" \
  -d "username=testuser" \
  -d "password=testpass" \
  -d "grant_type=password" \
  -d "scope=openid profile email" \
  | jq -r '.access_token' > token.txt
```

### Test 3: Verify Token with LangGraph

```bash
TOKEN=$(cat token.txt)

curl -X POST http://localhost:2024/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "Hello"}]}
  }' \
  | jq '.status'

# Should return: "success" or streaming response
# Not: "401 Unauthorized"
```

### Test 4: Inspect Token Claims

```bash
python3 << 'EOF'
import jwt
import json

token = open("token.txt").read().strip()

# Decode without verification (inspect claims)
claims = jwt.decode(token, options={"verify_signature": False})
print(json.dumps(claims, indent=2))
EOF
```

---

## Troubleshooting

### Error: "Unable to find signing key"

**Cause:** Token has a `kid` (key ID) that doesn't exist in JWKS.

**Solutions:**
1. Verify JWKS endpoint is correct:
   ```bash
   curl $JWT_JWKS_URI | jq '.keys | map(.kid)'
   ```

2. Check token's `kid`:
   ```bash
   python3 -c "import jwt; print(jwt.get_unverified_header('$TOKEN'))"
   ```

3. If endpoints match but still fails, your IdP may rotate keys frequently. Ensure `cache_jwk_set=True` is set in auth.py.

### Error: "Invalid issuer"

**Cause:** JWT issuer doesn't match `JWT_ISSUER`.

**Solution:** Decode token to check actual issuer:
```bash
python3 -c "import jwt, json; print(json.dumps(jwt.decode(open('token.txt').read().strip(), options={'verify_signature': False}), indent=2))" | grep '"iss"'
```

Compare with:
```bash
echo $JWT_ISSUER
```

They must match exactly (including trailing slashes).

### Error: "Invalid audience"

**Cause:** JWT audience doesn't match `JWT_AUDIENCE`.

**Solution:** Check token's audience claim:
```bash
python3 -c "import jwt, json; print(json.dumps(jwt.decode(open('token.txt').read().strip(), options={'verify_signature': False}), indent=2))" | grep '"aud"'
```

Ensure your IdP is issuing tokens with the correct audience.

### Error: "Token expired"

**Cause:** Token has expired.

**Solution:** Get a fresh token from your IdP (tokens typically expire in 1 hour).

### Error: "Connection refused" to JWKS endpoint

**Cause:** IdP is unreachable.

**Solution:**
```bash
curl $JWT_JWKS_URI -v
# Check firewall, DNS, and IdP status
```

### Performance: JWKS Fetched on Every Request

**Cause:** Cache is not working (might be disabled or TTL too short).

**Solution:** Verify cache settings in auth.py:
```python
jwks_client = PyJWKClient(JWKS_URI, cache_jwk_set=True, lifespan=3600)
#                                   ^^^^^^^^^^^^^^^^
#                                   Must be True
```

---

## Best Practices

1. **Always use HTTPS** for IdP endpoints in production
2. **Cache JWKS locally** (done automatically by PyJWKClient)
3. **Validate issuer and audience** if your IdP supports multiple clients
4. **Handle token expiry gracefully** (return 401, let client refresh)
5. **Log authentication failures** for debugging (but not tokens themselves)
6. **Use PKCE** in public clients (mobile, SPAs)

---

## Next Steps

- [OAuth-Direct Mode](./04-OAUTH-DIRECT.md) - for direct provider verification
- [API-Key Mode](./07-API-KEY.md) - for LangGraph Cloud
- [Custom Server Auth](./08-CUSTOM-SERVER-AUTH.md) - for advanced patterns
- Return to [Auth Architecture](./05-AUTH-ARCHITECTURE.md)
