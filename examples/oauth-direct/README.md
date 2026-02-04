# OAuth Direct (LangGraph 서버 직접 OAuth)

## 개요

`oauth-direct` 모드는 LangGraph 서버가 OAuth 토큰을 직접 검증하는 방식입니다.
NextAuth 없이 LangGraph 서버가 Google OAuth 토큰을 직접 검증합니다.

## 폴더 구조

```
oauth-direct/
├── README.md
├── frontend/
│   └── .env.example
└── server/
    ├── graph.py
    ├── auth.py         # Google OAuth 토큰 직접 검증
    ├── langgraph.json
    ├── .env.example
    └── pyproject.toml
```

---

## 일반 OAuth vs OAuth Direct

| 구분 | 일반 OAuth | OAuth Direct |
|------|------------|--------------|
| 토큰 검증 | NextAuth (Chat UI) | LangGraph 서버 |
| 프론트 DB | 필요 | 불필요 |
| 인증 흐름 | Google → NextAuth → JWT → LangGraph | Google → LangGraph 직접 검증 |

---

## 인증 흐름

```
사용자 → Google 로그인 → Access Token 획득
              ↓
         Chat UI → LangGraph 서버
              ↓
    auth.py에서 Google tokeninfo API로 직접 검증
```

---

## 설정 단계

### 1. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **APIs & Services** > **Credentials** > **OAuth client ID** 생성
3. Client ID 복사

### 2. LangGraph 서버 실행

```bash
cd examples/oauth-direct/server

cp .env.example .env
# 설정:
# - GOOGLE_CLIENT_ID
# - ANTHROPIC_API_KEY

pip install -e ".[dev]"
langgraph dev
```

### 3. Chat UI 실행

```bash
cd frontend

cp ../examples/oauth-direct/frontend/.env.example .env
# GOOGLE_CLIENT_ID 설정

pnpm install
pnpm dev
```

### 4. 테스트

1. `http://localhost:3000` 접속
2. Google 로그인
3. 획득한 토큰이 LangGraph 서버로 전달되어 직접 검증

---

## auth.py 핵심 코드

```python
@auth.authenticate
async def get_current_user(authorization: str | None):
    token = authorization.split(" ", 1)[1]

    # Google tokeninfo API로 직접 검증
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": token},
        )

    token_info = response.json()
    return {
        "identity": token_info.get("sub"),
        "email": token_info.get("email"),
    }
```

---

## 사용 사례

- NextAuth 없이 간단한 인증 구현
- LangGraph Cloud 배포 환경
- 마이크로서비스 아키텍처에서 인증 서버 분리

## 참고 자료

- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
