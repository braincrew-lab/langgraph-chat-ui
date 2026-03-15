# OAuth 토큰 직접 검증

LangGraph 서버에서 Google, GitHub 등 OAuth Provider의 토큰을 직접 검증하는 방식입니다. NextAuth 없이 프론트엔드나 CLI에서 직접 사용할 수 있습니다.

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [장단점](#장단점)
3. [Google OAuth 통합](#google-oauth-통합)
4. [GitHub OAuth 통합](#github-oauth-통합)
5. [Supabase 통합](#supabase-통합)
6. [Auth0 통합](#auth0-통합)
7. [멀티 Provider 지원](#멀티-provider-지원)

---

## 아키텍처 개요

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant OAuth as OAuth Provider
    participant LangGraph as LangGraph 서버

    rect rgb(240, 248, 255)
        Note over Client,OAuth: 1단계: OAuth 로그인 (클라이언트가 직접 처리)
        Client->>OAuth: OAuth 로그인 요청
        OAuth->>OAuth: 사용자 인증
        OAuth-->>Client: Access Token 발급
    end

    rect rgb(255, 248, 240)
        Note over Client,LangGraph: 2단계: API 호출 (LangGraph가 토큰 검증)
        Client->>LangGraph: API 요청 (Authorization: Bearer Token)
        LangGraph->>OAuth: 토큰 검증 (userinfo API)
        OAuth-->>LangGraph: 사용자 정보 반환
        LangGraph-->>Client: 스트리밍 응답
    end
```

### 핵심 특징

| 항목           | 설명                                      |
| -------------- | ----------------------------------------- |
| **토큰 발급**  | OAuth Provider (Google, GitHub 등)        |
| **토큰 검증**  | LangGraph 서버에서 Provider API 호출      |
| **프론트엔드** | 불필요 (CLI, 모바일 앱 등 직접 사용 가능) |
| **사용자 DB**  | 선택적 (Provider가 관리)                  |

---

## 장단점

### 장점

- **프론트엔드 독립**: Next.js 없이 동작
- **직접 통합**: Provider API와 직접 통신
- **다양한 클라이언트**: CLI, 모바일, 데스크톱 앱 지원
- **표준화**: OAuth 2.0 표준 준수

### 단점

- **API 호출 오버헤드**: 매 요청마다 Provider API 호출
- **Rate Limit**: Provider API 제한에 영향
- **직접 구현**: Provider별 코드 필요
- **토큰 관리**: 클라이언트가 직접 토큰 관리

---

## Google OAuth 통합

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant Google as Google OAuth
    participant LangGraph as LangGraph 서버
    participant UserInfo as Google UserInfo API

    rect rgb(240, 248, 255)
        Note over Client,Google: 1단계: Google OAuth 로그인
        Client->>Google: OAuth 로그인 시작
        Google->>Google: 사용자 인증 + 동의 화면
        Google-->>Client: Access Token (ya29.a0xxx...)
        Note right of Client: Access Token 저장
    end

    rect rgb(255, 248, 240)
        Note over Client,UserInfo: 2단계: LangGraph API 호출
        Client->>LangGraph: POST /runs<br/>Authorization: Bearer ya29.a0xxx
        LangGraph->>LangGraph: Bearer 토큰 추출
        LangGraph->>UserInfo: GET googleapis.com/oauth2/v3/userinfo<br/>Authorization: Bearer ya29.a0xxx
        UserInfo->>UserInfo: 토큰 유효성 검증
        UserInfo-->>LangGraph: { sub: "123", email: "user@gmail.com", name: "홍길동" }
        LangGraph->>LangGraph: identity = sub (Google 고유 ID)
        LangGraph->>LangGraph: 사용자별 스레드 필터링
        LangGraph->>LangGraph: Agent 실행
        LangGraph-->>Client: 스트리밍 응답
    end

    rect rgb(255, 240, 240)
        Note over Client,LangGraph: 에러 케이스: 토큰 만료
        Client->>LangGraph: POST /runs + 만료된 토큰
        LangGraph->>UserInfo: GET /userinfo + 만료된 토큰
        UserInfo-->>LangGraph: 401 Unauthorized
        LangGraph-->>Client: 401 "Invalid or expired Google token"
    end
```

### 구현

#### 환경 변수 (`.env`)

```env
# Google OAuth 검증에는 별도 환경변수 불필요
# (토큰 자체로 Google API 호출)
```

#### 인증 핸들러 (`src/security/auth.py`)

```python
import httpx
from langgraph_sdk import Auth

auth = Auth()

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Google OAuth Access Token 검증"""
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

    # Google API로 토큰 검증
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token}"}
        )

    if response.status_code != 200:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid or expired Google token"
        )

    user_info = response.json()

    return {
        "identity": user_info["sub"],  # Google 고유 ID
        "email": user_info.get("email", ""),
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
        "provider": "google",
    }


@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """사용자별 스레드 격리"""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    return {"owner": ctx.user.identity}
```

### 클라이언트 사용 예시

#### Python

```python
from langgraph_sdk import get_client

# Google에서 받은 Access Token
google_token = "ya29.a0..."

client = get_client(
    url="http://localhost:2024",
    headers={"Authorization": f"Bearer {google_token}"}
)

# 스레드 생성
thread = await client.threads.create()
```

#### cURL

```bash
curl -X POST http://localhost:2024/runs \
  -H "Authorization: Bearer ya29.a0..." \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "agent",
    "input": {"messages": [{"role": "user", "content": "Hello"}]}
  }'
```

---

## GitHub OAuth 통합

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant GitHub as GitHub OAuth
    participant LangGraph as LangGraph 서버
    participant GitHubAPI as GitHub API

    rect rgb(240, 248, 255)
        Note over Client,GitHub: 1단계: GitHub OAuth 로그인
        Client->>GitHub: OAuth 로그인 시작
        GitHub->>GitHub: 사용자 인증 + 권한 동의
        GitHub-->>Client: Access Token (gho_xxxx 또는 ghp_xxxx)
        Note right of Client: Personal Access Token도 사용 가능
    end

    rect rgb(240, 255, 240)
        Note over Client,GitHubAPI: 2단계: LangGraph API 호출
        Client->>LangGraph: POST /runs<br/>Authorization: Bearer gho_xxxx
        LangGraph->>LangGraph: Bearer 토큰 추출
        LangGraph->>GitHubAPI: GET api.github.com/user<br/>Authorization: Bearer gho_xxxx<br/>Accept: application/vnd.github+json
        GitHubAPI->>GitHubAPI: 토큰 유효성 검증
        GitHubAPI-->>LangGraph: { id: 12345, login: "username", email: "user@github.com" }
        LangGraph->>LangGraph: identity = id (GitHub 고유 ID)
        LangGraph->>LangGraph: Agent 실행
        LangGraph-->>Client: 스트리밍 응답
    end
```

### 구현

```python
import httpx
from langgraph_sdk import Auth

auth = Auth()

GITHUB_USER_URL = "https://api.github.com/user"


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """GitHub OAuth Access Token 검증"""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    # GitHub API로 토큰 검증
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
            }
        )

    if response.status_code != 200:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid or expired GitHub token"
        )

    user_info = response.json()

    return {
        "identity": str(user_info["id"]),
        "email": user_info.get("email", ""),
        "name": user_info.get("name", user_info["login"]),
        "avatar_url": user_info.get("avatar_url", ""),
        "provider": "github",
    }
```

---

## Supabase 통합

Supabase를 사용하면 Google, GitHub 등 여러 Provider를 단일 인터페이스로 관리할 수 있습니다.

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant Supabase as Supabase Auth
    participant Provider as OAuth Provider<br/>(Google/GitHub/Kakao)
    participant LangGraph as LangGraph 서버
    participant SupaAPI as Supabase API

    rect rgb(240, 248, 255)
        Note over Client,Provider: 1단계: Supabase 통합 OAuth 로그인
        Client->>Supabase: 소셜 로그인 요청 (Google/GitHub/Kakao)
        Supabase->>Provider: OAuth 리다이렉트
        Provider->>Provider: 사용자 인증
        Provider-->>Supabase: 인증 코드
        Supabase->>Supabase: 사용자 생성/조회 + JWT 생성
        Supabase-->>Client: Supabase JWT (access_token)
        Note right of Client: Supabase가 모든 Provider를<br/>단일 JWT로 통합
    end

    rect rgb(255, 248, 240)
        Note over Client,SupaAPI: 2단계: LangGraph API 호출
        Client->>LangGraph: POST /runs<br/>Authorization: Bearer {supabase_jwt}
        LangGraph->>LangGraph: Bearer 토큰 추출
        LangGraph->>SupaAPI: GET /auth/v1/user<br/>Authorization: Bearer {jwt}<br/>apikey: {service_key}
        SupaAPI->>SupaAPI: JWT 검증 + 사용자 조회
        SupaAPI-->>LangGraph: { id: "uuid", email: "...", app_metadata: { provider: "google" } }
        LangGraph->>LangGraph: identity = id, provider = app_metadata.provider
        LangGraph->>LangGraph: Agent 실행
        LangGraph-->>Client: 스트리밍 응답
    end
```

### 구현

#### 환경 변수 (`.env`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 인증 핸들러

```python
import os
import httpx
from langgraph_sdk import Auth

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

auth = Auth()


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Supabase JWT 검증"""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    # Supabase API로 토큰 검증
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            }
        )

    if response.status_code != 200:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail="Invalid or expired Supabase token"
        )

    user_data = response.json()

    # Provider 정보 추출
    provider = "email"
    if user_data.get("app_metadata", {}).get("provider"):
        provider = user_data["app_metadata"]["provider"]

    return {
        "identity": user_data["id"],
        "email": user_data.get("email", ""),
        "provider": provider,
        "metadata": user_data.get("user_metadata", {}),
    }
```

---

## Auth0 통합

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant Auth0 as Auth0
    participant LangGraph as LangGraph 서버
    participant JWKS as Auth0 JWKS

    rect rgb(240, 248, 255)
        Note over Client,Auth0: 1단계: Auth0 로그인 (Universal Login)
        Client->>Auth0: 로그인 요청
        Auth0->>Auth0: Universal Login 화면 표시
        Auth0->>Auth0: 사용자 인증 (ID/PW, Social, MFA)
        Auth0->>Auth0: RS256으로 JWT 서명
        Auth0-->>Client: JWT (id_token + access_token)
        Note right of Client: RS256 서명된 JWT
    end

    rect rgb(255, 248, 240)
        Note over Client,JWKS: 2단계: LangGraph API 호출 (JWKS 검증)
        Client->>LangGraph: POST /runs<br/>Authorization: Bearer {jwt}
        LangGraph->>LangGraph: JWT 헤더에서 kid 추출
        LangGraph->>JWKS: GET /.well-known/jwks.json
        JWKS-->>LangGraph: { keys: [{ kid, n, e, ... }] }
        LangGraph->>LangGraph: kid로 공개키 찾기
        LangGraph->>LangGraph: RS256 서명 검증
        LangGraph->>LangGraph: audience, issuer 검증
        LangGraph->>LangGraph: 토큰 만료 시간 검증
        Note right of LangGraph: DB 호출 없이 암호학적 검증!
        LangGraph->>LangGraph: Agent 실행
        LangGraph-->>Client: 스트리밍 응답
    end
```

### 구현

#### 환경 변수 (`.env`)

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

#### 인증 핸들러

```python
import os
import httpx
import jwt
from jwt import PyJWKClient
from langgraph_sdk import Auth

AUTH0_DOMAIN = os.environ["AUTH0_DOMAIN"]
AUTH0_AUDIENCE = os.environ["AUTH0_AUDIENCE"]

# Auth0 JWKS URL
JWKS_URL = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)

auth = Auth()


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """Auth0 JWT 검증"""
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    try:
        # JWKS로 서명 검증
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
    except jwt.ExpiredSignatureError:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise Auth.exceptions.HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return {
        "identity": payload["sub"],
        "email": payload.get("email", ""),
        "permissions": payload.get("permissions", []),
        "provider": "auth0",
    }
```

---

## 멀티 Provider 지원

여러 OAuth Provider를 동시에 지원하는 방법입니다.

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant LangGraph as LangGraph 서버
    participant Google as Google API
    participant GitHub as GitHub API
    participant Supabase as Supabase API

    rect rgb(240, 248, 255)
        Note over Client,LangGraph: 토큰 포맷: "Bearer {provider}:{token}"
        Client->>LangGraph: POST /runs<br/>Authorization: Bearer google:ya29.xxx
    end

    rect rgb(255, 248, 240)
        Note over LangGraph,Supabase: Provider별 분기 처리
        LangGraph->>LangGraph: 토큰에서 provider 추출 ("google")

        alt provider == "google"
            LangGraph->>Google: GET /userinfo + ya29.xxx
            Google-->>LangGraph: { sub, email, name }
            LangGraph->>LangGraph: identity = "google:sub"
        else provider == "github"
            LangGraph->>GitHub: GET /user + gho_xxx
            GitHub-->>LangGraph: { id, login, email }
            LangGraph->>LangGraph: identity = "github:id"
        else provider == "supabase"
            LangGraph->>Supabase: GET /auth/v1/user + jwt
            Supabase-->>LangGraph: { id, email, app_metadata }
            LangGraph->>LangGraph: identity = "supabase:id"
        end

        LangGraph->>LangGraph: Agent 실행
        LangGraph-->>Client: 응답
    end
```

### 구현

```python
import os
import httpx
from langgraph_sdk import Auth

auth = Auth()

# Provider 설정
PROVIDERS = {
    "google": {
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "id_field": "sub",
    },
    "github": {
        "userinfo_url": "https://api.github.com/user",
        "id_field": "id",
        "extra_headers": {"Accept": "application/vnd.github+json"},
    },
    "supabase": {
        "userinfo_url": f"{os.environ.get('SUPABASE_URL', '')}/auth/v1/user",
        "id_field": "id",
        "extra_headers": {"apikey": os.environ.get("SUPABASE_SERVICE_KEY", "")},
    },
}


@auth.authenticate
async def authenticate(authorization: str | None) -> Auth.types.MinimalUserDict:
    """멀티 Provider 토큰 검증

    토큰 포맷: "Bearer {provider}:{token}"
    예: "Bearer google:ya29.xxx" 또는 "Bearer github:gho_xxx"
    """
    if not authorization:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Unauthorized")

    scheme, _, token_part = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token_part:
        raise Auth.exceptions.HTTPException(status_code=401, detail="Invalid token")

    # Provider 감지
    if ":" in token_part:
        provider, token = token_part.split(":", 1)
    else:
        # 기본값: 토큰 prefix로 추측
        if token_part.startswith("ya29."):
            provider, token = "google", token_part
        elif token_part.startswith("gho_") or token_part.startswith("ghp_"):
            provider, token = "github", token_part
        else:
            provider, token = "supabase", token_part

    if provider not in PROVIDERS:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail=f"Unsupported provider: {provider}"
        )

    config = PROVIDERS[provider]

    # Provider API로 검증
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        headers.update(config.get("extra_headers", {}))

        response = await client.get(config["userinfo_url"], headers=headers)

    if response.status_code != 200:
        raise Auth.exceptions.HTTPException(
            status_code=401,
            detail=f"Invalid {provider} token"
        )

    user_info = response.json()

    return {
        "identity": f"{provider}:{user_info[config['id_field']]}",
        "email": user_info.get("email", ""),
        "name": user_info.get("name", user_info.get("login", "")),
        "provider": provider,
    }


@auth.on
async def filter_by_owner(ctx: Auth.types.AuthContext, value: dict) -> dict:
    """Provider 포함 identity로 격리"""
    metadata = value.setdefault("metadata", {})
    metadata["owner"] = ctx.user.identity
    metadata["provider"] = ctx.user.get("provider", "unknown")
    return {"owner": ctx.user.identity}
```

### 클라이언트 사용

```python
# Google 사용자
client = get_client(
    url="http://localhost:2024",
    headers={"Authorization": "Bearer google:ya29.a0..."}
)

# GitHub 사용자
client = get_client(
    url="http://localhost:2024",
    headers={"Authorization": "Bearer github:gho_..."}
)

# 또는 토큰만 (자동 감지)
client = get_client(
    url="http://localhost:2024",
    headers={"Authorization": "Bearer ya29.a0..."}  # Google로 자동 감지
)
```

---

## 캐싱으로 성능 최적화

```mermaid
sequenceDiagram
    autonumber
    participant Client as 클라이언트
    participant LangGraph as LangGraph 서버
    participant Cache as 메모리 캐시
    participant Provider as Provider API

    rect rgb(240, 255, 240)
        Note over Client,Provider: 첫 번째 요청: 캐시 미스
        Client->>LangGraph: API 요청 + 토큰
        LangGraph->>Cache: 캐시 조회 (hash(token))
        Cache-->>LangGraph: 캐시 미스
        LangGraph->>Provider: 토큰 검증 요청
        Provider-->>LangGraph: 사용자 정보
        LangGraph->>Cache: 캐시 저장 (TTL: 5분)
        LangGraph-->>Client: 응답
    end

    rect rgb(255, 255, 240)
        Note over Client,Cache: 두 번째 요청: 캐시 히트
        Client->>LangGraph: API 요청 + 동일 토큰
        LangGraph->>Cache: 캐시 조회 (hash(token))
        Cache-->>LangGraph: 캐시 히트! 사용자 정보 반환
        Note right of LangGraph: Provider API 호출 없음!
        LangGraph-->>Client: 응답 (더 빠름)
    end
```

```python
from functools import lru_cache
import time
import hashlib

# 간단한 메모리 캐시
_token_cache: dict[str, tuple[dict, float]] = {}
CACHE_TTL = 300  # 5분


async def verify_token_with_cache(provider: str, token: str) -> dict:
    """토큰 검증 결과 캐싱"""
    cache_key = hashlib.sha256(f"{provider}:{token}".encode()).hexdigest()

    # 캐시 확인
    if cache_key in _token_cache:
        user_info, cached_at = _token_cache[cache_key]
        if time.time() - cached_at < CACHE_TTL:
            return user_info

    # Provider API 호출
    user_info = await verify_with_provider(provider, token)

    # 캐시 저장
    _token_cache[cache_key] = (user_info, time.time())

    return user_info
```

---

## 체크리스트

- [ ] 사용할 OAuth Provider 선택
- [ ] Provider Console에서 앱 등록 및 설정
- [ ] 환경 변수 설정
- [ ] auth.py에서 Provider별 검증 로직 구현
- [ ] 토큰 캐싱 적용 (선택)
- [ ] 에러 처리 및 로깅 구현
- [ ] 클라이언트 테스트

---

## 다음 단계

- 완전한 자체 인증 시스템 구축: [05-STANDALONE.md](./05-STANDALONE.ko.md)
- 개요로 돌아가기: [00-OVERVIEW.md](./00-OVERVIEW.ko.md)
