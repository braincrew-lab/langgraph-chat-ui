"""Authentication handler for OAuth Direct mode.

In OAuth Direct mode, the LangGraph server handles OAuth authentication directly
without NextAuth. This example validates Google OAuth tokens.

The frontend obtains OAuth tokens from Google and sends them to the LangGraph
server, which validates them directly with Google's API.

Reference:
- https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/
- https://developers.google.com/identity/protocols/oauth2
"""

import os

import httpx
from langgraph_sdk import Auth

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

auth = Auth()

AUTH_EXCEPTION = Auth.exceptions.HTTPException(
    status_code=401,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


@auth.authenticate
async def get_current_user(
    authorization: str | None,
) -> Auth.types.MinimalUserDict:
    """Validate Google OAuth access token directly.

    This validates the token by calling Google's tokeninfo endpoint.
    No NextAuth or intermediate server is involved.

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
        # Extract token from "Bearer <token>"
        token = authorization.split(" ", 1)[1]

        # Validate token with Google's tokeninfo endpoint
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"access_token": token},
            )

        if response.status_code != 200:
            raise AUTH_EXCEPTION

        token_info = response.json()

        # Verify the token was issued for our app
        if GOOGLE_CLIENT_ID and token_info.get("aud") != GOOGLE_CLIENT_ID:
            raise AUTH_EXCEPTION

        # Extract user info from token
        return {
            "identity": token_info.get("sub"),  # Google user ID
            "email": token_info.get("email"),
            "display_name": token_info.get("email"),  # Use email as display name
            "is_authenticated": True,
        }

    except (IndexError, KeyError, ConnectionError) as e:
        raise AUTH_EXCEPTION from e


@auth.on
async def add_owner(
    ctx: Auth.types.AuthContext,
    value: dict,
):
    """Add owner metadata to resources for per-user isolation.

    This ensures users can only access their own conversation threads.
    """
    filters = {"owner": ctx.user.identity}
    metadata = value.setdefault("metadata", {})
    metadata.update(filters)
    return filters
