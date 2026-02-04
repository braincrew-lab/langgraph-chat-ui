"""Authentication handler for NextAuth.js JWT tokens (multiple OAuth providers).

This module validates JWT tokens issued by NextAuth.js regardless of which
OAuth provider (Google, GitHub, etc.) was used for authentication.
NextAuth.js normalizes the user data into a standard format.

Reference: https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/
"""

import os

import jwt
from jwt.exceptions import InvalidTokenError
from langgraph_sdk import Auth

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
    """Validate NextAuth.js JWT token from any OAuth provider.

    NextAuth.js normalizes user info from different providers into a
    consistent format, so validation is the same regardless of provider.
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
            "picture": payload.get("picture"),
            "is_authenticated": True,
        }

    except (ValueError, InvalidTokenError) as e:
        raise AUTH_EXCEPTION from e


@auth.on
async def add_owner(
    ctx: Auth.types.AuthContext,
    value: dict,
):
    """Add owner metadata to resources for per-user isolation."""
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
