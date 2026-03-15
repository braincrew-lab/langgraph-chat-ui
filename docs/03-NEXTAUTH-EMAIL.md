# NextAuth Email Authentication

This approach uses NextAuth's Email Provider to handle Magic Link login and verifies the JWT on the LangGraph server.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Pros and Cons](#pros-and-cons)
3. [Implementation Guide](#implementation-guide)
4. [LangGraph Integration](#langgraph-integration)

---

## Architecture Overview

```mermaid
sequenceDiagram
    autonumber
    participant Client as Client
    participant NextJS as Next.js Server
    participant Email as Email Service
    participant LangGraph as LangGraph Server

    rect rgb(240, 248, 255)
        Note over Client,Email: Step 1: Login Flow (Handled by NextAuth)
        Client->>NextJS: Enter email
        NextJS->>NextJS: Generate Magic Link
        NextJS->>Email: Send login link
        Email-->>Client: Email received
        Client->>NextJS: Click Magic Link
        NextJS->>NextJS: Verify token + Generate JWT
        NextJS-->>Client: Store session + JWT token
    end

    rect rgb(255, 248, 240)
        Note over Client,LangGraph: Step 2: API Call Flow (LangGraph only verifies)
        Client->>NextJS: Chat request + session
        NextJS->>LangGraph: API request (Authorization: Bearer JWT)
        LangGraph->>LangGraph: Verify JWT signature
        LangGraph-->>Client: Streaming response
    end
```

---

## Pros and Cons

### Pros

- **No password required**: Reduced security burden
- **Easy signup**: Login and signup handled simultaneously with just an email
- **Security**: Authentication via email ownership verification

### Cons

- **Email dependency**: Email service is required
- **Latency**: Must wait for email delivery
- **Spam risk**: Sent emails may be flagged as spam

---

## Implementation Guide

### 1. NextAuth Configuration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY!;

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const langgraphToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
        },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      session.langgraphToken = langgraphToken;
      session.user.id = user.id;
      return session;
    },
  },
  secret: JWT_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 2. Prisma Schema

The Email Provider requires a DB Adapter.

```prisma
// prisma/schema.prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### 3. Environment Variables

```env
# .env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# JWT (shared with LangGraph)
JWT_SECRET_KEY=your-shared-jwt-secret

# Email (e.g., Gmail SMTP)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Database
DATABASE_URL=postgresql://...
```

### 4. Custom Email Template (Optional)

```typescript
EmailProvider({
  // ...
  sendVerificationRequest: async ({ identifier, url, provider }) => {
    const { host } = new URL(url);
    await sendEmail({
      to: identifier,
      subject: `Sign in to ${host}`,
      html: `
        <h1>Login Link</h1>
        <p>Click the button below to sign in.</p>
        <a href="${url}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Sign In
        </a>
        <p>This link is valid for 24 hours.</p>
      `,
    });
  },
});
```

---

## LangGraph Integration

The LangGraph-side configuration is the same as in [01-NEXTAUTH-OAUTH.md](./01-NEXTAUTH-OAUTH.md). You only need to verify the JWT signature.

```python
# src/security/auth.py
import os
import jwt
from langgraph_sdk import Auth

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"

auth = Auth()


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Verify JWT token issued by NextAuth"""
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
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    return {
        "identity": payload.get("sub"),
        "email": payload.get("email", ""),
    }
```

---

## Checklist

- [ ] NextAuth Email Provider configured
- [ ] Prisma Adapter configured
- [ ] Email service configured (SMTP)
- [ ] DB migration completed
- [ ] JWT_SECRET_KEY set identically on both sides
- [ ] LangGraph auth.py implemented
- [ ] Email template customized (optional)

---

## Next Steps

- Add OAuth login: [01-NEXTAUTH-OAUTH.md](./01-NEXTAUTH-OAUTH.md)
- Add ID/PW login: [02-NEXTAUTH-CREDENTIALS.md](./02-NEXTAUTH-CREDENTIALS.md)
