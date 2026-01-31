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

### 시스템 구성

```mermaid
flowchart TB
    subgraph Client["클라이언트 (브라우저)"]
        UI[React UI]
    end

    subgraph NextJS["Next.js 서버"]
        Auth[NextAuth + Prisma]
        API[API Routes]
        Auth --> DB[(SQLite)]
    end

    subgraph LangGraph["LangGraph 서버"]
        JWT[JWT 검증]
        Agent[Agent 실행]
        JWT --> Agent
    end

    UI -->|로그인/회원가입| Auth
    UI -->|채팅 요청| API
    API -->|JWT 토큰| JWT
    Agent -->|스트리밍 응답| API
    API -->|응답 전달| UI
```

### 인증 시퀀스

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant NextJS as Next.js
    participant DB as SQLite
    participant LangGraph as LangGraph

    rect rgb(240, 248, 255)
        Note over Client,DB: 로그인 (Next.js가 인증 담당)
        Client->>NextJS: POST /api/auth/signin
        NextJS->>DB: 사용자 조회
        DB-->>NextJS: 사용자 정보
        NextJS->>NextJS: 비밀번호 검증 (bcrypt)
        NextJS->>NextJS: JWT 생성 (AUTH_SECRET)
        NextJS-->>Client: 세션 쿠키 + JWT
    end

    rect rgb(255, 248, 240)
        Note over Client,LangGraph: 채팅 (LangGraph는 검증만)
        Client->>NextJS: POST /api/runs/stream
        NextJS->>NextJS: 세션에서 JWT 추출
        NextJS->>LangGraph: Authorization: Bearer {JWT}
        LangGraph->>LangGraph: JWT 서명 검증
        Note right of LangGraph: DB 접근 없음
        LangGraph-->>NextJS: SSE 스트리밍
        NextJS-->>Client: 스트리밍 전달
    end
```

### 역할 분리

| 구성 요소 | 역할 | DB 접근 |
|----------|------|---------|
| **Next.js** | 사용자 인증, DB 관리, JWT 발급 | ✅ 필요 |
| **LangGraph** | JWT 검증, 에이전트 실행 | ❌ 불필요 |

### 핵심 원칙

- **Next.js**: 사용자 관리의 **Single Source of Truth**
- **LangGraph**: 토큰 서명 검증만 수행, 사용자 DB에 접근하지 않음
- **JWT Secret**: 두 서버가 동일한 시크릿 공유 (`AUTH_SECRET` = `JWT_SECRET_KEY`)

---

## Next.js 인증 서버

### 지원 데이터베이스

| DB | 지원 상태 | 용도 |
|----|----------|------|
| **SQLite** | ✅ 현재 지원 | 개발, 소규모 배포 |
| **PostgreSQL** | 🔜 추후 지원 예정 | 프로덕션 확장 |
| **MySQL** | 🔜 추후 지원 예정 | 프로덕션 확장 |

> **참고**: 현재 버전은 SQLite만 지원합니다. Prisma ORM을 사용하므로 추후 PostgreSQL, MySQL 등 다른 RDB로 쉽게 확장할 수 있습니다.

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

        // pending/suspended 사용자 차단
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
datasource db {
  provider = "sqlite"  // 현재: SQLite, 추후: postgresql, mysql
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

### 3. 환경 변수

```env
# Next.js (.env)

# 인증 시크릿 (LangGraph JWT_SECRET_KEY와 동일해야 함)
AUTH_SECRET=your-secret-key-min-32-chars

# 데이터베이스 (현재 SQLite만 지원)
DATABASE_URL="file:./prisma/dev.db"

# 추후 PostgreSQL 사용 시:
# DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

### 4. 사용자 상태 흐름

```mermaid
stateDiagram-v2
    [*] --> pending: 회원가입 (승인 필요 시)
    [*] --> active: 회원가입 (자유 가입)

    pending --> active: 관리자 승인
    pending --> [*]: 관리자 거부

    active --> suspended: 관리자 정지
    suspended --> active: 관리자 재활성화

    note right of pending: 로그인 불가
    note right of suspended: 로그인 불가
```

---

## LangGraph JWT 검증

LangGraph 서버는 Next.js가 발급한 JWT를 검증만 합니다. 사용자 DB에 접근하지 않습니다.

### 검증 흐름

```mermaid
flowchart LR
    A[요청 수신] --> B{Authorization<br/>헤더 존재?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{Bearer 토큰<br/>형식?}
    D -->|No| C
    D -->|Yes| E{JWT 서명<br/>유효?}
    E -->|No| C
    E -->|Yes| F{토큰<br/>만료?}
    F -->|Yes| C
    F -->|No| G[사용자 정보 추출]
    G --> H[config에 주입]
    H --> I[Agent 실행]
```

### 1. 의존성

```toml
# pyproject.toml
[project]
dependencies = [
    "langgraph>=0.2.0",
    "pyjwt>=2.8.0",
]
```

### 2. 환경 변수

```env
# LangGraph 서버 (.env)
JWT_SECRET_KEY=your-secret-key-min-32-chars  # Next.js AUTH_SECRET과 동일!
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

### 5. 그래프에서 사용자 정보 접근

```python
def my_node(state, config):
    # JWT에서 추출된 사용자 정보
    user = config["configurable"].get("langgraph_auth_user", {})

    user_id = user.get("identity")
    email = user.get("email")
    role = user.get("role")

    # 사용자별 로직 처리...
    return {"messages": [...]}
```

---

## 리소스 접근 제어

`@auth.on.*` 데코레이터로 사용자별 리소스 격리를 구현합니다.

### 스레드 격리 흐름

```mermaid
flowchart TB
    subgraph Create["스레드 생성"]
        C1[요청] --> C2[metadata.owner = user_id 설정]
        C2 --> C3[스레드 저장]
    end

    subgraph Read["스레드 조회"]
        R1[요청] --> R2[owner = user_id 필터 적용]
        R2 --> R3[본인 스레드만 반환]
    end

    subgraph Update["스레드 수정"]
        U1[요청] --> U2{owner = user_id?}
        U2 -->|Yes| U3[수정 허용]
        U2 -->|No| U4[403 Forbidden]
    end
```

### 구현 코드

```python
@auth.on.threads.create
@auth.on.threads.read
@auth.on.threads.update
@auth.on.threads.delete
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """모든 스레드 작업에 소유자 필터를 적용합니다."""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

---

## 클라이언트 연동

### API Passthrough 패턴

```mermaid
sequenceDiagram
    participant Client as 클라이언트
    participant NextJS as Next.js API
    participant LangGraph as LangGraph

    Client->>NextJS: POST /api/runs/stream<br/>(세션 쿠키)
    NextJS->>NextJS: 세션 검증
    NextJS->>NextJS: JWT 토큰 추출
    NextJS->>LangGraph: POST /runs/stream<br/>(Authorization: Bearer)
    LangGraph-->>NextJS: SSE 스트림
    NextJS-->>Client: SSE 스트림 전달
```

### 구현 코드

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

## 보안 체크리스트

- [ ] `AUTH_SECRET` = `JWT_SECRET_KEY` (32자 이상 랜덤 문자열)
- [ ] 프로덕션에서 HTTPS 적용
- [ ] JWT 만료 시간 설정 (권장: 1-24시간)
- [ ] pending/suspended 사용자 로그인 차단 확인

---

## 참고 자료

- [NextAuth.js 공식 문서](https://authjs.dev/)
- [LangGraph Authentication](https://langchain-ai.github.io/langgraph/cloud/how-tos/auth/)
- [Prisma ORM](https://www.prisma.io/docs)
