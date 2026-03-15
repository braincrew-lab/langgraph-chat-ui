# Authentication Examples

LangGraph Chat UI의 인증 모드별 설정 예제입니다.

## 레포지토리 구조

```
langgraph-chat-ui/
├── frontend/           # Next.js Chat UI
│   ├── src/
│   ├── package.json
│   └── ...
├── examples/           # 인증 모드별 예제
│   ├── standalone/
│   │   ├── frontend/   # Chat UI 환경변수
│   │   └── server/     # LangGraph 서버 코드
│   └── ...
└── README.md
```

---

## AUTH_MODE 개요

| 모드 | 설명 | 프론트 DB | 토큰 검증 |
|------|------|----------|----------|
| `standalone` | 인증 없음 | 불필요 | 없음 |
| `credentials` | 이메일/비밀번호 | 필요 | NextAuth JWT |
| `oauth` | OAuth (Google, GitHub) | 필요 | NextAuth JWT |
| `oauth-direct` | LangGraph 서버 OAuth | 불필요 | 직접 검증 |

---

## 예제 목록

| 폴더 | AUTH_MODE | 설명 |
|------|-----------|------|
| [standalone/](./standalone/) | `standalone` | 인증 없음 (로컬 개발용) |
| [basic-auth/](./basic-auth/) | `credentials` | 이메일/비밀번호 |
| [google-oauth/](./google-oauth/) | `oauth` | Google OAuth |
| [github-oauth/](./github-oauth/) | `oauth` | GitHub OAuth |
| [multiple-oauth/](./multiple-oauth/) | `oauth` | 다중 OAuth |
| [oauth-direct/](./oauth-direct/) | `oauth-direct` | LangGraph 서버 직접 OAuth |

---

## 빠른 시작

### 1. 인증 모드 선택

```
개발/테스트      → standalone
단순 프로덕션   → credentials (basic-auth)
소셜 로그인     → oauth (google-oauth, github-oauth)
LangGraph Cloud → oauth-direct
```

### 2. 예제 폴더 구조

```
{example}/
├── README.md           # 설정 가이드
├── frontend/
│   └── .env.example    # Chat UI 환경변수
└── server/
    ├── graph.py        # 에이전트 그래프
    ├── auth.py         # 인증 핸들러 (standalone 제외)
    ├── langgraph.json  # 서버 설정
    ├── .env.example    # 서버 환경변수
    └── pyproject.toml
```

### 3. 설정 방법

```bash
# 1. LangGraph 서버 실행
cd examples/{선택한-예제}/server
cp .env.example .env
# .env 파일 설정
pip install -e ".[dev]"
langgraph dev

# 2. Chat UI 실행 (새 터미널)
cd frontend
cp ../examples/{선택한-예제}/frontend/.env.example .env
# .env 파일 설정
pnpm install
pnpm dev
```

---

## 인증 흐름 비교

### NextAuth 기반 (credentials, oauth)

```
사용자 → Chat UI → NextAuth.js → JWT 토큰 발급
                         ↓
           LangGraph 서버 (auth.py에서 JWT 검증)
```

**중요:** `NEXTAUTH_SECRET`은 Chat UI와 LangGraph 서버에서 동일해야 합니다.

### OAuth Direct

```
사용자 → Google 로그인 → Access Token
              ↓
    LangGraph 서버에서 Google API로 직접 검증
```

---

## 데이터베이스 옵션

`basic-auth`에서 DATABASE_URL만 변경하면 다양한 DB 사용 가능:

```env
# SQLite (개발)
DATABASE_URL="file:./prisma/dev.db"

# PostgreSQL
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# MySQL
DATABASE_URL="mysql://user:password@host:3306/dbname"
```

---

## 참고 자료

- [LangGraph Custom Auth](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/)
- [NextAuth.js](https://authjs.dev/)
- [langchain-ai/custom-auth](https://github.com/langchain-ai/custom-auth)
