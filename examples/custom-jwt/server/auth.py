"""Authentication handler for Custom JWT mode (JWKS-based validation).

This module validates JWT tokens issued by an external Identity Provider
(e.g., Keycloak, Auth0, Supabase, Okta) using JWKS public key verification.

Environment variables:
- JWT_JWKS_URI: JWKS endpoint URL (e.g., https://auth.example.com/.well-known/jwks.json)
- JWT_ISSUER: Expected token issuer (optional, for validation)
- JWT_AUDIENCE: Expected token audience (optional, for validation)

Reference: https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/
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
