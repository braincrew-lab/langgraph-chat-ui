# Google OAuth

## 개요

`oauth` 모드에서 Google을 OAuth 공급자로 사용하는 설정입니다.

## 폴더 구조

```
google-oauth/
├── README.md
├── frontend/
│   └── .env.example    # Chat UI 환경변수
└── server/
    ├── graph.py
    ├── auth.py         # JWT 토큰 검증
    ├── langgraph.json
    ├── .env.example
    └── pyproject.toml
```

---

## Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**
3. **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`

---

## 설정 단계

### 1. LangGraph 서버 실행

```bash
cd examples/google-oauth/server

cp .env.example .env
# NEXTAUTH_SECRET, ANTHROPIC_API_KEY 설정

pip install -e ".[dev]"
langgraph dev
```

### 2. Chat UI 실행

```bash
cd frontend

cp ../examples/google-oauth/frontend/.env.example .env
# 설정:
# - NEXTAUTH_SECRET (서버와 동일!)
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET

pnpm install
npx prisma generate && npx prisma db push
pnpm dev
```

### 3. 테스트

1. `http://localhost:3000` 접속
2. "Google로 로그인" 클릭

---

## 인증 흐름

```
사용자 → "Google 로그인" → Google OAuth
              ↓
         NextAuth.js → JWT 토큰 발급
              ↓
    LangGraph 서버 (auth.py에서 JWT 검증)
```

## 참고 자료

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
