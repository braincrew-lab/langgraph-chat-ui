# GitHub OAuth

## 개요

`oauth` 모드에서 GitHub을 OAuth 공급자로 사용하는 설정입니다.

## 폴더 구조

```
github-oauth/
├── README.md
├── frontend/
│   └── .env.example
└── server/
    ├── graph.py
    ├── auth.py
    ├── langgraph.json
    ├── .env.example
    └── pyproject.toml
```

---

## GitHub OAuth 설정

1. [GitHub Developer Settings](https://github.com/settings/developers) 접속
2. **OAuth Apps** > **New OAuth App**
3. **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

---

## 설정 단계

### 1. LangGraph 서버 실행

```bash
cd examples/github-oauth/server

cp .env.example .env
# NEXTAUTH_SECRET, ANTHROPIC_API_KEY 설정

pip install -e ".[dev]"
langgraph dev
```

### 2. Chat UI 실행

```bash
cd frontend

cp ../examples/github-oauth/frontend/.env.example .env
# 설정:
# - NEXTAUTH_SECRET (서버와 동일!)
# - GITHUB_CLIENT_ID
# - GITHUB_CLIENT_SECRET

pnpm install
npx prisma generate && npx prisma db push
pnpm dev
```

### 3. 테스트

1. `http://localhost:3000` 접속
2. "GitHub로 로그인" 클릭

## 참고 자료

- [GitHub OAuth](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
