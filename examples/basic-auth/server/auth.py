"""Authentication handler for NextAuth.js JWT tokens.

This module validates JWT tokens issued by NextAuth.js (credentials mode).
It extracts user identity from the token and applies per-user resource isolation.

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

        # Decode and validate the JWT token
        # NextAuth.js uses HS256 by default
        payload = jwt.decode(
            token,
            NEXTAUTH_SECRET,
            algorithms=[ALGORITHM],
        )

        # Extract user info from NextAuth.js token payload
        # NextAuth.js stores user info in the 'sub' claim (user ID)
        # and optionally in 'name', 'email' claims
        user_id = payload.get("sub")
        if not user_id:
            raise AUTH_EXCEPTION

        return {
            "identity": user_id,
            "display_name": payload.get("name"),
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

    Args:
        ctx: Authentication context with user information
        value: The resource being created/accessed

    Returns:
        Filters to apply for resource access
    """
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
