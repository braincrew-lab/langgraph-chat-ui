# Multiple OAuth (다중 OAuth 공급자)

## 개요

`oauth` 모드에서 여러 OAuth 공급자(Google, GitHub 등)를 동시에 사용하는 설정입니다.

## 폴더 구조

```
multiple-oauth/
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

## 설정 단계

### 1. OAuth 공급자 설정

- **Google**: [Google Cloud Console](https://console.cloud.google.com/)
- **GitHub**: [GitHub Developer Settings](https://github.com/settings/developers)

### 2. LangGraph 서버 실행

```bash
cd examples/multiple-oauth/server

cp .env.example .env
# NEXTAUTH_SECRET, ANTHROPIC_API_KEY 설정

pip install -e ".[dev]"
langgraph dev
```

### 3. Chat UI 실행

```bash
cd frontend

cp ../examples/multiple-oauth/frontend/.env.example .env
# 설정:
# - NEXTAUTH_SECRET (서버와 동일!)
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

pnpm install
npx prisma generate && npx prisma db push
pnpm dev
```

### 4. 테스트

1. `http://localhost:3000` 접속
2. 원하는 공급자로 로그인 선택

---

## 공급자 활성화 조건

환경 변수가 설정된 공급자만 로그인 버튼에 표시됩니다:

| 공급자 | 필요한 환경 변수 |
|--------|------------------|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |

## 참고 자료

- [Google OAuth 가이드](../google-oauth/)
- [GitHub OAuth 가이드](../github-oauth/)
