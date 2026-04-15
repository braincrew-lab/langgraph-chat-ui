---
name: integrate
description: Connect LangGraph Chat UI to a LangGraph server. Configures frontend .env, generates auth handler, and sets up the backend server. Accepts server path as argument.
argument-hint: "/path/to/langgraph-server"
user_invocable: true
---

# LangGraph Chat UI Integration Skill

Connect this Chat UI to a LangGraph backend server with the correct auth mode configured on both sides.

## Step 1: Parse Argument

`$ARGUMENTS` is the backend server path. If empty, ask the user:

> What is the path to your LangGraph server directory?

## Step 2: Detect Current State

Read the following files and report what is already configured:

- `frontend/.env` — check `AUTH_MODE`, `NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET`
- `<server-path>/langgraph.json` — check if `auth` key exists
- `<server-path>/src/security/auth.py` — check if auth handler exists

Report a short summary of findings before proceeding.

## Step 3: Ask Auth Mode

Ask the user (use AskUserQuestion):

```
Which auth mode do you want to configure?

1. standalone    — No auth, local dev/demos
2. credentials   — Email/password login (NextAuth)
3. oauth         — Social login: Google, GitHub (NextAuth)
4. email         — Magic link via email (NextAuth)
5. oauth-direct  — LangGraph handles OAuth directly (no NextAuth)
6. custom-jwt    — External IdP: Keycloak, Auth0, Supabase (JWKS)
7. api-key       — LangGraph Cloud API key
```

## Step 4: Ask Mode-Specific Inputs

Based on the chosen mode, ask ONE follow-up question for all required inputs:

**standalone**: No additional input needed. Proceed directly.

**credentials**: Ask:
```
Database provider? (sqlite / postgresql / mysql)
If postgresql/mysql, provide DATABASE_URL:
```

**oauth**: Ask:
```
Which OAuth providers? (google / github / both)
Provide credentials:
- Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- GitHub: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
Database provider? (sqlite / postgresql / mysql)
```

**email**: Ask:
```
SMTP server configuration:
- EMAIL_SERVER_HOST (e.g., smtp.gmail.com)
- EMAIL_SERVER_PORT (e.g., 587)
- EMAIL_SERVER_USER
- EMAIL_SERVER_PASSWORD
- EMAIL_FROM (e.g., noreply@yourdomain.com)
Database provider? (sqlite / postgresql / mysql)
```

**oauth-direct**: Ask:
```
LangGraph server URL? (default: http://localhost:2024)
```

**custom-jwt**: Ask:
```
Identity Provider configuration:
- JWT_JWKS_URI (required, e.g., https://your-idp/.well-known/jwks.json)
- JWT_ISSUER (optional)
- JWT_AUDIENCE (optional)

Common providers:
- Keycloak: https://keycloak.example.com/realms/{realm}/protocol/openid-connect/certs
- Auth0: https://your-tenant.auth0.com/.well-known/jwks.json
- Supabase: https://your-project.supabase.co/auth/v1/.well-known/jwks.json
```

**api-key**: Ask:
```
LangGraph Cloud API key? (starts with lsv2_pt_)
Leave empty to show input form to users instead.
```

## Step 5: Execute Setup

Follow the reference file for the chosen mode:

| Mode | Reference |
|------|-----------|
| standalone | [auth-standalone.md](auth-standalone.md) |
| credentials | [auth-nextauth.md](auth-nextauth.md) |
| oauth | [auth-nextauth.md](auth-nextauth.md) |
| email | [auth-nextauth.md](auth-nextauth.md) |
| oauth-direct | [auth-oauth-direct.md](auth-oauth-direct.md) |
| custom-jwt | [auth-custom-jwt.md](auth-custom-jwt.md) |
| api-key | [auth-api-key.md](auth-api-key.md) |

## Step 6: Verify

Run the verification checklist from the reference file for the chosen mode.

## Important Notes

- Reference `docs/ENV_MATRIX.md` for env var requirements per mode
- Reference `docs/TROUBLESHOOTING.md` for common errors
- The JWT secret must be identical on frontend and backend — this is the most common integration error
- For NextAuth modes (credentials/oauth/email): `NEXTAUTH_SECRET` on frontend = `NEXTAUTH_SECRET` on backend
