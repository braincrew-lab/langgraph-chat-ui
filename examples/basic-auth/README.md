# Basic Auth (이메일/비밀번호)

## 개요

`credentials` 모드는 이메일과 비밀번호를 사용한 전통적인 인증 방식입니다.

## 폴더 구조

```
basic-auth/
├── README.md
├── frontend/
│   └── .env.example    # Chat UI 환경변수
└── server/
    ├── graph.py        # 에이전트 그래프
    ├── auth.py         # JWT 토큰 검증
    ├── langgraph.json  # 서버 설정 (인증 포함)
    ├── .env.example    # 서버 환경변수
    └── pyproject.toml
```

---

## 설정 단계

### 1. LangGraph 서버 실행

```bash
cd examples/basic-auth/server

cp .env.example .env
# .env 파일 설정:
# - NEXTAUTH_SECRET (Chat UI와 동일한 값!)
# - ANTHROPIC_API_KEY

pip install -e ".[dev]"
langgraph dev
```

### 2. Chat UI 실행

```bash
cd frontend  # 레포 루트의 frontend 폴더

cp ../examples/basic-auth/frontend/.env.example .env
# .env 파일 설정:
# - NEXTAUTH_SECRET (서버와 동일한 값!)

# NEXTAUTH_SECRET 생성
openssl rand -base64 32

pnpm install
npx prisma generate
npx prisma db push
pnpm dev
```

**중요:** `NEXTAUTH_SECRET`은 Chat UI와 LangGraph 서버에서 동일한 값을 사용해야 합니다!

### 3. 테스트

1. `http://localhost:3000` 접속
2. "계정 만들기" 클릭하여 회원가입
3. 로그인 후 채팅 사용

---

## 인증 흐름

```
사용자 → Chat UI → NextAuth.js → JWT 토큰 발급
                         ↓
           LangGraph 서버 (auth.py에서 JWT 검증)
```

---

## 문제 해결

### "Invalid or expired token" 에러
Chat UI와 LangGraph 서버의 `NEXTAUTH_SECRET`이 동일한지 확인

## 참고 자료

- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
- [NextAuth.js](https://authjs.dev/)
