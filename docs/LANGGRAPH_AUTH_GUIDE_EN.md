# Authentication System Architecture Guide

This document explains the architecture where Next.js handles DB-based user authentication, and the LangGraph server only performs JWT verification.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Next.js Authentication Server](#nextjs-authentication-server)
3. [LangGraph JWT Verification](#langgraph-jwt-verification)
4. [Resource Access Control](#resource-access-control)
5. [Client Integration](#client-integration)

---

## Architecture Overview

### System Components

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        UI[React UI]
    end

    subgraph NextJS["Next.js Server"]
        Auth[NextAuth + Prisma]
        API[API Routes]
        Auth --> DB[(SQLite)]
    end

    subgraph LangGraph["LangGraph Server"]
        JWT[JWT Verification]
        Agent[Agent Execution]
        JWT --> Agent
    end

    UI -->|Login/Register| Auth
    UI -->|Chat Request| API
    API -->|JWT Token| JWT
    Agent -->|Streaming Response| API
    API -->|Forward Response| UI
```

### Authentication Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client
    participant NextJS as Next.js
    participant DB as SQLite
    participant LangGraph as LangGraph

    rect rgb(240, 248, 255)
        Note over Client,DB: Login (Next.js handles authentication)
        Client->>NextJS: POST /api/auth/signin
        NextJS->>DB: User lookup
        DB-->>NextJS: User info
        NextJS->>NextJS: Password verification (bcrypt)
        NextJS->>NextJS: JWT creation (AUTH_SECRET)
        NextJS-->>Client: Session cookie + JWT
    end

    rect rgb(255, 248, 240)
        Note over Client,LangGraph: Chat (LangGraph only verifies)
        Client->>NextJS: POST /api/runs/stream
        NextJS->>NextJS: Extract JWT from session
        NextJS->>LangGraph: Authorization: Bearer {JWT}
        LangGraph->>LangGraph: JWT signature verification
        Note right of LangGraph: No DB access
        LangGraph-->>NextJS: SSE streaming
        NextJS-->>Client: Forward stream
    end
```

### Separation of Responsibilities

| Component     | Role                                    | DB Access  |
| ------------- | --------------------------------------- | ---------- |
| **Next.js**   | User authentication, DB management, JWT issuance | Required   |
| **LangGraph** | JWT verification, agent execution       | Not needed |

### Core Principles

- **Next.js**: The **Single Source of Truth** for user management
- **LangGraph**: Only verifies token signatures, does not access user DB
- **JWT Secret**: Both servers share the same secret (`AUTH_SECRET` = `JWT_SECRET_KEY`)

---

## Next.js Authentication Server

### Supported Databases

| DB             | Support Status     | Use Case                |
| -------------- | ------------------ | ----------------------- |
| **SQLite**     | Currently supported | Development, small deployments |
| **PostgreSQL** | Planned            | Production scaling      |
| **MySQL**      | Planned            | Production scaling      |

> **Note**: The current version only supports SQLite. Since Prisma ORM is used, it can be easily extended to other RDBs such as PostgreSQL and MySQL in the future.

### 1. NextAuth Configuration

`src/lib/auth/config.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

// JWT secret (shared with LangGraph)
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "your-secret-key",
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) return null;

        // Block pending/suspended users
        if (user.status !== "active") return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;

        // Generate JWT for LangGraph
        session.langgraphToken = await new SignJWT({
          sub: token.id,
          email: token.email,
          role: token.role,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(JWT_SECRET);
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
});
```

### 2. Prisma Schema

`prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"  // Current: SQLite, Future: postgresql, mysql
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?
  name          String?
  role          String    @default("user")   // "user" | "admin"
  status        String    @default("active") // "active" | "pending" | "suspended"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model GlobalSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt
}
```

### 3. Environment Variables

```env
# Next.js (.env)

# Auth secret (must be the same as LangGraph JWT_SECRET_KEY)
AUTH_SECRET=your-secret-key-min-32-chars

# Database (currently SQLite only)
DATABASE_URL="file:./prisma/dev.db"

# For future PostgreSQL use:
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

### 4. User Status Flow

```mermaid
stateDiagram-v2
    [*] --> pending: Registration (when approval required)
    [*] --> active: Registration (open registration)

    pending --> active: Admin approval
    pending --> [*]: Admin rejection

    active --> suspended: Admin suspension
    suspended --> active: Admin reactivation

    note right of pending: Login disabled
    note right of suspended: Login disabled
```

---

## LangGraph JWT Verification

The LangGraph server only verifies JWTs issued by Next.js. It does not access the user database.

### Verification Flow

```mermaid
flowchart LR
    A[Request received] --> B{Authorization<br/>header present?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{Bearer token<br/>format?}
    D -->|No| C
    D -->|Yes| E{JWT signature<br/>valid?}
    E -->|No| C
    E -->|Yes| F{Token<br/>expired?}
    F -->|Yes| C
    F -->|No| G[Extract user info]
    G --> H[Inject into config]
    H --> I[Execute Agent]
```

### 1. Dependencies

```toml
# pyproject.toml
[project]
dependencies = [
    "langgraph>=0.2.0",
    "pyjwt>=2.8.0",
]
```

### 2. Environment Variables

```env
# LangGraph Server (.env)
JWT_SECRET_KEY=your-secret-key-min-32-chars  # Must be the same as Next.js AUTH_SECRET!
```

### 3. Authentication Handler

`src/security/auth.py`:

```python
import os
import jwt
from langgraph_sdk import Auth

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"

auth = Auth()


@auth.authenticate
async def authenticate(authorization: str | None) -> tuple[list[str], dict]:
    """
    Verifies JWTs issued by Next.js.
    Only checks the token signature without accessing the user DB.
    """
    if not authorization:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Authorization header required"
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid authorization scheme"
        )

    try:
        # JWT signature verification (no DB access)
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Token expired"
        )
    except jwt.InvalidTokenError:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    # Return verified user info
    return (
        [payload.get("role", "user")],
        {
            "identity": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "user"),
        }
    )
```

### 4. langgraph.json

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph.py:graph"
  },
  "auth": {
    "path": "src/security/auth.py:auth"
  },
  "env": ".env"
}
```

### 5. Accessing User Info in Graph

```python
def my_node(state, config):
    # User info extracted from JWT
    user = config["configurable"].get("langgraph_auth_user", {})

    user_id = user.get("identity")
    email = user.get("email")
    role = user.get("role")

    # Process user-specific logic...
    return {"messages": [...]}
```

---

## Resource Access Control

Use `@auth.on.*` decorators to implement per-user resource isolation.

### Thread Isolation Flow

```mermaid
flowchart TB
    subgraph Create["Thread Creation"]
        C1[Request] --> C2[Set metadata.owner = user_id]
        C2 --> C3[Save thread]
    end

    subgraph Read["Thread Read"]
        R1[Request] --> R2[Apply owner = user_id filter]
        R2 --> R3[Return only user's threads]
    end

    subgraph Update["Thread Update"]
        U1[Request] --> U2{owner = user_id?}
        U2 -->|Yes| U3[Allow modification]
        U2 -->|No| U4[403 Forbidden]
    end
```

### Implementation Code

```python
@auth.on.threads.create
@auth.on.threads.read
@auth.on.threads.update
@auth.on.threads.delete
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Apply owner filter to all thread operations."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

---

## Client Integration

### API Passthrough Pattern

```mermaid
sequenceDiagram
    participant Client as Client
    participant NextJS as Next.js API
    participant LangGraph as LangGraph

    Client->>NextJS: POST /api/runs/stream<br/>(session cookie)
    NextJS->>NextJS: Session verification
    NextJS->>NextJS: Extract JWT token
    NextJS->>LangGraph: POST /runs/stream<br/>(Authorization: Bearer)
    LangGraph-->>NextJS: SSE stream
    NextJS-->>Client: Forward SSE stream
```

### Implementation Code

`src/app/api/[..._path]/route.ts`:

```typescript
import { createApiHandler } from "langgraph-nextjs-api-passthrough";
import { auth } from "@/lib/auth";

const handler = createApiHandler({
  apiUrl: process.env.LANGGRAPH_API_URL!,
  beforeRequest: async (request) => {
    const session = await auth();
    if (session?.langgraphToken) {
      request.headers.set("Authorization", `Bearer ${session.langgraphToken}`);
    }
    return request;
  },
});

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

---

## Security Checklist

- [ ] `AUTH_SECRET` = `JWT_SECRET_KEY` (random string of 32+ characters)
- [ ] HTTPS enabled in production
- [ ] JWT expiration time configured (recommended: 1-24 hours)
- [ ] Verify that pending/suspended users are blocked from login

---

## References

- [NextAuth.js Official Documentation](https://authjs.dev/)
- [LangGraph Authentication](https://langchain-ai.github.io/langgraph/cloud/how-tos/auth/)
- [Prisma ORM](https://www.prisma.io/docs)
