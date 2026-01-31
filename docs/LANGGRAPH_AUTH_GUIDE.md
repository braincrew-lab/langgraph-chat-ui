# 인증 시스템 아키텍처 가이드

Next.js에서 DB 기반 사용자 인증을 처리하고, LangGraph 서버에서는 JWT 검증만 수행하는 구조를 설명합니다.

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [Next.js 인증 서버](#nextjs-인증-서버)
3. [LangGraph JWT 검증](#langgraph-jwt-검증)
4. [리소스 접근 제어](#리소스-접근-제어)
5. [클라이언트 연동](#클라이언트-연동)

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                         클라이언트 (브라우저)                         │
└─────────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ 로그인/회원가입            │ 채팅 요청 + JWT
                    ▼                           ▼
┌─────────────────────────────┐    ┌─────────────────────────────────┐
│      Next.js 서버           │    │        LangGraph 서버            │
│  ┌───────────────────────┐  │    │  ┌───────────────────────────┐  │
│  │  NextAuth + Prisma    │  │    │  │   JWT 검증 (@auth)        │  │
│  │  - 사용자 DB 관리     │  │    │  │   - 토큰 서명 확인만      │  │
│  │  - 로그인/회원가입    │  │    │  │   - 사용자 DB 접근 없음   │  │
│  │  - JWT 발급          │  │    │  └───────────────────────────┘  │
│  └───────────────────────┘  │    │               │                 │
│             │               │    │               ▼                 │
│             ▼               │    │  ┌───────────────────────────┐  │
│  ┌───────────────────────┐  │    │  │   LangGraph Agent 실행    │  │
│  │      PostgreSQL       │  │    │  │   (config에 사용자 정보)  │  │
│  │      / SQLite         │  │    │  └───────────────────────────┘  │
│  └───────────────────────┘  │    └─────────────────────────────────┘
└─────────────────────────────┘
```

### 역할 분리

| 구성 요소 | 역할 | DB 접근 |
|----------|------|---------|
| **Next.js** | 사용자 인증, DB 관리, JWT 발급 | ✅ 필요 |
| **LangGraph** | JWT 검증, 에이전트 실행 | ❌ 불필요 |

### 핵심 원칙

- **Next.js**: 사용자 관리의 **Single Source of Truth**
- **LangGraph**: 토큰 검증만 수행, 사용자 DB에 접근하지 않음
- **JWT Secret**: 두 서버가 동일한 시크릿 공유

---

## Next.js 인증 서버

### 1. NextAuth 설정

`src/lib/auth/config.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

// JWT 시크릿 (LangGraph와 공유)
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "your-secret-key"
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
          user.password
        );

        if (!isValid) return null;

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

        // LangGraph용 JWT 생성
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

### 2. Prisma 스키마

`prisma/schema.prisma`:

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?
  name          String?
  role          String    @default("user")  // "user" | "admin"
  status        String    @default("active") // "active" | "pending" | "suspended"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### 3. 회원가입 API

`src/app/api/auth/register/route.ts`:

```typescript
import { prisma } from "@/lib/auth/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password, name } = await request.json();

  // 이메일 중복 확인
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "이미 등록된 이메일입니다" },
      { status: 400 }
    );
  }

  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 12);

  // 첫 번째 사용자는 자동으로 관리자
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "admin" : "user";

  // 사용자 생성
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      status: "active",
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
  });
}
```

### 4. 환경 변수

```env
# Next.js (.env)
AUTH_SECRET=your-secret-key-min-32-chars
DATABASE_URL="file:./dev.db"  # 또는 PostgreSQL URL
```

> **중요**: `AUTH_SECRET`은 LangGraph 서버의 `JWT_SECRET_KEY`와 동일해야 합니다.

---

## LangGraph JWT 검증

LangGraph 서버는 Next.js가 발급한 JWT를 검증만 합니다. 사용자 DB에 접근하지 않습니다.

### 1. 의존성

```toml
# pyproject.toml
dependencies = [
    "pyjwt>=2.8.0",
    "langgraph>=0.2.0",
]
```

### 2. 환경 변수

```env
# LangGraph 서버 (.env)
JWT_SECRET_KEY=your-secret-key-min-32-chars  # Next.js AUTH_SECRET과 동일
```

### 3. 인증 핸들러

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
    Next.js에서 발급한 JWT를 검증합니다.
    사용자 DB에 접근하지 않고 토큰 서명만 확인합니다.
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
        # JWT 서명 검증 (DB 접근 없음)
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

    # 검증된 사용자 정보 반환
    # → config["configurable"]["langgraph_auth_user"]에 주입됨
    return (
        [payload.get("role", "user")],  # 권한 목록
        {
            "identity": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "user"),
        }
    )
```

### 4. langgraph.json 설정

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

### 5. 그래프에서 사용자 정보 접근

```python
def my_node(state, config):
    # 인증된 사용자 정보 (JWT payload에서 추출)
    user = config["configurable"].get("langgraph_auth_user", {})

    user_id = user.get("identity")
    email = user.get("email")
    role = user.get("role")

    # 사용자별 로직 처리
    return {"messages": [...]}
```

---

## 리소스 접근 제어

`@auth.on.*` 데코레이터로 사용자별 리소스 격리를 구현합니다.

### 사용자별 스레드 격리

```python
@auth.on.threads.create
@auth.on.threads.read
@auth.on.threads.update
@auth.on.threads.delete
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """
    모든 스레드 작업에 소유자 필터를 적용합니다.
    """
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

### 동작 방식

| 작업 | 처리 |
|------|------|
| 스레드 생성 | `metadata.owner = user_id` 자동 저장 |
| 스레드 목록 | `WHERE owner = user_id` 자동 필터 |
| 스레드 조회 | 본인 소유만 접근 가능 |
| 스레드 수정/삭제 | 본인 소유만 가능 |

---

## 클라이언트 연동

### React에서 LangGraph API 호출

```typescript
import { useSession } from "next-auth/react";

function ChatComponent() {
  const { data: session } = useSession();

  const sendMessage = async (message: string) => {
    const response = await fetch("http://localhost:2024/runs/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Next.js에서 발급받은 JWT 사용
        Authorization: `Bearer ${session?.langgraphToken}`,
      },
      body: JSON.stringify({
        assistant_id: "agent",
        input: { messages: [{ role: "user", content: message }] },
      }),
    });

    // 스트리밍 응답 처리...
  };
}
```

### API Passthrough 패턴

Next.js API Route를 통해 LangGraph 요청을 프록시하면 토큰 관리가 더 간편합니다.

`src/app/api/langgraph/[...path]/route.ts`:

```typescript
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // LangGraph 서버로 프록시
  const langgraphUrl = process.env.LANGGRAPH_API_URL;
  const path = request.url.split("/api/langgraph")[1];

  return fetch(`${langgraphUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.langgraphToken}`,
    },
    body: await request.text(),
  });
}
```

---

## 보안 체크리스트

- [ ] `AUTH_SECRET` / `JWT_SECRET_KEY`를 32자 이상 랜덤 문자열로 설정
- [ ] 두 서버의 시크릿이 정확히 일치하는지 확인
- [ ] 프로덕션에서 HTTPS 적용
- [ ] JWT 만료 시간 적절히 설정 (권장: 1-24시간)
- [ ] Next.js에서 사용자 상태(suspended, pending) 검증

---

## 참고 자료

- [NextAuth.js 공식 문서](https://authjs.dev/)
- [LangGraph Authentication](https://langchain-ai.github.io/langgraph/cloud/how-tos/auth/)
- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
