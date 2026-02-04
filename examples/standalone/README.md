# Standalone Mode (인증 없음)

## 개요

`standalone` 모드는 인증 없이 LangGraph Chat UI를 사용하는 가장 간단한 설정입니다.

## 폴더 구조

```
standalone/
├── README.md
├── frontend/
│   └── .env.example    # Chat UI 환경변수
└── server/
    ├── graph.py        # 에이전트 그래프
    ├── langgraph.json  # 서버 설정
    ├── .env.example    # 서버 환경변수
    └── pyproject.toml  # Python 의존성
```

---

## 설정 단계

### 1. LangGraph 서버 실행

```bash
cd examples/standalone/server

# 환경변수 설정
cp .env.example .env
# .env 파일에서 ANTHROPIC_API_KEY 설정

# 의존성 설치 및 실행
pip install -e ".[dev]"
langgraph dev
```

서버가 `http://localhost:2024`에서 실행됩니다.

### 2. Chat UI 실행

```bash
cd frontend  # 레포 루트의 frontend 폴더

# 환경변수 설정
cp ../examples/standalone/frontend/.env.example .env

# 의존성 설치 및 실행
pnpm install
pnpm dev
```

### 3. 테스트

1. `http://localhost:3000` 접속
2. 로그인 화면 없이 바로 채팅 인터페이스 표시

---

## 서버 설정

### langgraph.json

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./graph.py:graph"
  },
  "env": ".env"
}
```

**참고:** `auth` 섹션이 없으므로 인증이 비활성화됩니다.

---

## 특징

- 인증/데이터베이스 불필요
- 최소 설정으로 빠른 시작
- 로컬 개발/테스트용

## 주의사항

- 프로덕션 환경에서는 권장하지 않음
- 사용자 구분 없음

## 참고 자료

- [LangGraph 문서](https://langchain-ai.github.io/langgraph/)
