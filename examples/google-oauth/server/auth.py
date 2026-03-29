"""Authentication handler for NextAuth.js JWT tokens (OAuth mode).

This module validates JWT tokens issued by NextAuth.js when using OAuth providers
(Google, GitHub, etc.). The token validation is the same regardless of the OAuth
provider - NextAuth.js handles provider-specific logic on the frontend.

Reference: https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/
"""

import os

import jwt
from jwt.exceptions import InvalidTokenError
from langgraph_sdk import Auth

# NextAuth.js configuration
# NEXTAUTH_SECRET is used to sign JWT tokens
NEXTAUTH_SECRET = os.environ["NEXTAUTH_SECRET"]
ALGORITHM = "HS256"

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
    """Validate NextAuth.js JWT token and extract user information.

    The JWT token contains user info from the OAuth provider (Google),
    normalized by NextAuth.js into a standard format.

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
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise AUTH_EXCEPTION

        payload = jwt.decode(
            token,
            NEXTAUTH_SECRET,
            algorithms=[ALGORITHM],
        )

        user_id = payload.get("sub")
        if not user_id:
            raise AUTH_EXCEPTION

        return {
            "identity": user_id,
            "display_name": payload.get("name"),
            "email": payload.get("email"),
            # OAuth-specific: picture URL from Google
            "picture": payload.get("picture"),
            "is_authenticated": True,
        }

    except (ValueError, InvalidTokenError) as e:
        raise AUTH_EXCEPTION from e


@auth.on.threads
async def add_owner(
    ctx: Auth.types.AuthContext,
    value: dict,
):
    """Add owner metadata to threads for per-user isolation."""
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
