# Environment Variable Matrix

Required (R) / Optional (O) / Not used (-) per auth mode.

## Core Variables

| Variable | standalone | credentials | oauth | email | oauth-direct |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | R | R | R | R | R |
| `AUTH_MODE` | R | R | R | R | R |
| `DATABASE_URL` | - | R | R | R | - |
| `DATABASE_PROVIDER` | - | O (sqlite) | O (sqlite) | O (sqlite) | - |
| `NEXTAUTH_SECRET` | - | R | R | R | - |
| `NEXTAUTH_URL` | - | R | R | R | - |

## LangGraph Variables

| Variable | standalone | credentials | oauth | email | oauth-direct |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_ASSISTANT_ID` | O | O | O | O | O |
| `LANGGRAPH_API_URL` | O | O | O | O | O |
| `NEXT_PUBLIC_LANGCHAIN_API_KEY` | O | O | O | O | O |

## OAuth Provider Variables

| Variable | standalone | credentials | oauth | email | oauth-direct |
|---|---|---|---|---|---|
| `GOOGLE_CLIENT_ID` | - | - | O* | - | - |
| `GOOGLE_CLIENT_SECRET` | - | - | O* | - | - |
| `GITHUB_CLIENT_ID` | - | - | O* | - | - |
| `GITHUB_CLIENT_SECRET` | - | - | O* | - | - |

\* At least one OAuth provider (Google or GitHub) is required for `oauth` mode.

## Email Provider Variables

| Variable | standalone | credentials | oauth | email | oauth-direct |
|---|---|---|---|---|---|
| `EMAIL_SERVER_HOST` | - | - | - | R | - |
| `EMAIL_SERVER_PORT` | - | - | - | R | - |
| `EMAIL_SERVER_USER` | - | - | - | R | - |
| `EMAIL_SERVER_PASSWORD` | - | - | - | R | - |
| `EMAIL_FROM` | - | - | - | R | - |

## LangSmith Variables (Optional)

| Variable | Description |
|---|---|
| `LANGSMITH_API_KEY` | LangSmith API key for tracing |
| `LANGSMITH_PROJECT` | LangSmith project name |

## Security Variables (Optional)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | (auto-detect) | App URL for CORS validation |
| `MAX_UPLOAD_SIZE_MB` | `10` | Max file upload size in MB |
| `UPLOAD_DIR` | `public/uploads` | File upload directory |
| `JWT_EXPIRATION_TIME` | `1h` | JWT token expiration |
| `SECURITY_HEADER_X_FRAME_OPTIONS` | `DENY` | X-Frame-Options header |
| `SECURITY_HEADER_CSP` | `frame-ancestors 'none'` | Content-Security-Policy header |
