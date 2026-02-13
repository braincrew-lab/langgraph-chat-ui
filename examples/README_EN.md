# Authentication Examples

Configuration examples for each authentication mode of LangGraph Chat UI.

## Repository Structure

```
langgraph-chat-ui/
├── frontend/           # Next.js Chat UI
│   ├── src/
│   ├── package.json
│   └── ...
├── examples/           # Examples by auth mode
│   ├── standalone/
│   │   ├── frontend/   # Chat UI environment variables
│   │   └── server/     # LangGraph server code
│   └── ...
└── README.md
```

---

## AUTH_MODE Overview

| Mode | Description | Frontend DB | Token Verification |
|------|-------------|------------|-------------------|
| `standalone` | No authentication | Not required | None |
| `credentials` | Email/password | Required | NextAuth JWT |
| `oauth` | OAuth (Google, GitHub) | Required | NextAuth JWT |
| `oauth-direct` | LangGraph server OAuth | Not required | Direct verification |

---

## Example List

| Folder | AUTH_MODE | Description |
|--------|-----------|-------------|
| [standalone/](./standalone/) | `standalone` | No authentication (for local development) |
| [basic-auth/](./basic-auth/) | `credentials` | Email/password |
| [google-oauth/](./google-oauth/) | `oauth` | Google OAuth |
| [github-oauth/](./github-oauth/) | `oauth` | GitHub OAuth |
| [multiple-oauth/](./multiple-oauth/) | `oauth` | Multiple OAuth providers |
| [oauth-direct/](./oauth-direct/) | `oauth-direct` | LangGraph server direct OAuth |

---

## Quick Start

### 1. Choose an Authentication Mode

```
Development/Testing   → standalone
Simple Production     → credentials (basic-auth)
Social Login          → oauth (google-oauth, github-oauth)
LangGraph Cloud       → oauth-direct
```

### 2. Example Folder Structure

```
{example}/
├── README.md           # Setup guide
├── frontend/
│   └── .env.example    # Chat UI environment variables
└── server/
    ├── graph.py        # Agent graph
    ├── auth.py         # Authentication handler (except standalone)
    ├── langgraph.json  # Server configuration
    ├── .env.example    # Server environment variables
    └── pyproject.toml
```

### 3. Setup Instructions

```bash
# 1. Run LangGraph server
cd examples/{chosen-example}/server
cp .env.example .env
# Configure the .env file
pip install -e ".[dev]"
langgraph dev

# 2. Run Chat UI (new terminal)
cd frontend
cp ../examples/{chosen-example}/frontend/.env.example .env
# Configure the .env file
pnpm install
pnpm dev
```

---

## Authentication Flow Comparison

### NextAuth-Based (credentials, oauth)

```
User → Chat UI → NextAuth.js → JWT Token Issuance
                         ↓
           LangGraph Server (JWT verification in auth.py)
```

**Important:** `NEXTAUTH_SECRET` must be the same in both Chat UI and the LangGraph server.

### OAuth Direct

```
User → Google Login → Access Token
              ↓
    LangGraph server verifies directly via Google API
```

---

## Database Options

In `basic-auth`, you can use various databases by simply changing DATABASE_URL:

```env
# SQLite (development)
DATABASE_URL="file:./prisma/dev.db"

# PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# MySQL
DATABASE_URL="mysql://user:password@host:3306/dbname"
```

---

## References

- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
- [NextAuth.js](https://authjs.dev/)
- [langchain-ai/custom-auth](https://github.com/langchain-ai/custom-auth)
