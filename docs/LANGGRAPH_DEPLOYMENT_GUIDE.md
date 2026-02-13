# LangGraph 서버 배포 가이드

LangGraph 에이전트 서버를 프로덕션 환경에 배포하는 두 가지 방법을 설명합니다.

## 목차

1. [배포 옵션 비교](#배포-옵션-비교)
2. [Option A: Docker 기반 배포](#option-a-docker-기반-배포)
3. [Option B: LangSmith 기반 배포](#option-b-langsmith-기반-배포)
4. [프로덕션 체크리스트](#프로덕션-체크리스트)

---

## 배포 옵션 비교

| 항목               | Docker 기반           | LangSmith 기반         |
| ------------------ | --------------------- | ---------------------- |
| **인프라 관리**    | 직접 관리             | 완전 관리형            |
| **비용**           | 인프라 비용만         | LangSmith 요금         |
| **LangSmith 필수** | ❌ 불필요             | ✅ 필수                |
| **커스터마이징**   | 완전한 제어           | 플랫폼 제한            |
| **모니터링**       | 직접 구축             | LangSmith 내장         |
| **권장 환경**      | Air-gapped, 완전 독립 | 빠른 구축, 관리형 선호 |

---

## Option A: Docker 기반 배포

LangSmith 없이 Docker Compose로 완전 독립적인 환경을 구축합니다.

### 1. 프로젝트 구조

```
langgraph-server/
├── src/
│   ├── agent/
│   │   └── graph.py          # LangGraph 그래프 정의
│   └── security/
│       └── auth.py           # JWT 검증 핸들러
├── langgraph.json            # LangGraph 설정
├── pyproject.toml            # Python 의존성
├── docker-compose.yml
└── .env
```

### 2. langgraph.json

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

### 3. pyproject.toml

```toml
[project]
name = "langgraph-server"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "langgraph>=0.2.0",
    "langchain-openai>=0.2.0",
    "pyjwt>=2.8.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### 4. Docker 이미지 빌드

```bash
# LangGraph CLI 설치
pip install -U "langgraph-cli[inmem]"

# Docker 이미지 빌드
langgraph build -t my-agent:latest
```

### 5. docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: langgraph
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-langgraph}
      POSTGRES_DB: langgraph
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langgraph"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  langgraph-api:
    image: my-agent:latest
    ports:
      - "2024:8000"
    environment:
      DATABASE_URI: postgres://langgraph:${POSTGRES_PASSWORD:-langgraph}@postgres:5432/langgraph
      REDIS_URI: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 6. 환경 변수 (.env)

```env
# LLM
OPENAI_API_KEY=sk-...

# JWT 인증 (Next.js AUTH_SECRET과 동일)
JWT_SECRET_KEY=your-secret-key-min-32-chars

# PostgreSQL
POSTGRES_PASSWORD=secure-password-here
```

### 7. 실행

```bash
# 시작
docker compose up -d

# 로그 확인
docker compose logs -f langgraph-api

# 헬스체크
curl http://localhost:2024/health

# 중지
docker compose down
```

### 8. 클라우드 배포

#### AWS ECS

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR_URL

# 이미지 푸시
docker tag my-agent:latest $ECR_URL/my-agent:latest
docker push $ECR_URL/my-agent:latest
```

필요한 인프라:

- **ECS Fargate** 또는 **EC2**
- **RDS PostgreSQL**
- **ElastiCache Redis**

#### GCP Cloud Run

```bash
# Artifact Registry 로그인
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 이미지 푸시
docker tag my-agent:latest asia-northeast3-docker.pkg.dev/$PROJECT/repo/my-agent:latest
docker push asia-northeast3-docker.pkg.dev/$PROJECT/repo/my-agent:latest
```

필요한 인프라:

- **Cloud Run**
- **Cloud SQL PostgreSQL**
- **Memorystore Redis**

---

## Option B: LangSmith 기반 배포

LangSmith Platform을 사용한 관리형 배포입니다.

### 1. LangSmith 계정 설정

1. [smith.langchain.com](https://smith.langchain.com) 가입 (무료 티어 가능)
2. **Settings** → **API Keys** → 키 생성
3. API 키 저장

### 2. LangGraph Cloud (완전 관리형)

GitHub 저장소를 연결하여 자동 배포합니다.

#### 설정 방법

1. [smith.langchain.com](https://smith.langchain.com) → **Deployments**
2. **New Deployment** → GitHub 저장소 연결
3. 환경 변수 설정:
   - `OPENAI_API_KEY`
   - `JWT_SECRET_KEY`
4. 배포 시작

배포 완료 후:

```
https://your-deployment-id.langgraph.app
```

### 3. Self-Hosted + LangSmith 모니터링

Docker로 직접 호스팅하면서 LangSmith 트레이싱을 사용합니다.

#### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: langgraph
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-langgraph}
      POSTGRES_DB: langgraph
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langgraph"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  langgraph-api:
    image: my-agent:latest
    ports:
      - "2024:8000"
    environment:
      DATABASE_URI: postgres://langgraph:${POSTGRES_PASSWORD:-langgraph}@postgres:5432/langgraph
      REDIS_URI: redis://redis:6379
      LANGSMITH_API_KEY: ${LANGSMITH_API_KEY} # 추가
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

#### 환경 변수

```env
# LangSmith
LANGSMITH_API_KEY=lsv2_pt_xxxxx

# LLM
OPENAI_API_KEY=sk-...

# JWT 인증
JWT_SECRET_KEY=your-secret-key-min-32-chars

# PostgreSQL
POSTGRES_PASSWORD=secure-password
```

### 4. LangSmith 기능

| 기능           | 설명                                |
| -------------- | ----------------------------------- |
| **Tracing**    | 모든 LLM 호출 및 에이전트 실행 추적 |
| **Monitoring** | 지연시간, 토큰 사용량, 에러율       |
| **Playground** | 그래프 테스트 및 디버깅             |
| **Datasets**   | 테스트 데이터셋 관리                |
| **Evaluation** | 에이전트 성능 평가                  |

---

## 프로덕션 체크리스트

- [ ] `JWT_SECRET_KEY`를 32자 이상 랜덤 값으로 설정
- [ ] HTTPS 적용 (nginx, traefik, 또는 클라우드 로드밸런서)
- [ ] CORS 설정 (허용된 오리진만)
- [ ] Rate limiting 적용

### 인프라

- [ ] PostgreSQL 백업 설정
- [ ] Redis 영구 저장 설정 (AOF)
- [ ] 컨테이너 리소스 제한 (CPU, 메모리)
- [ ] 로드 밸런서 설정 (다중 인스턴스)

### 모니터링

- [ ] 헬스체크 엔드포인트 모니터링
- [ ] 로그 수집 (CloudWatch, Stackdriver, ELK)
- [ ] 에러 트래킹 (Sentry)
- [ ] 메트릭 수집 (Prometheus, Datadog)

---

## 비용 비교

| 항목             | Docker 기반 | LangSmith Cloud    |
| ---------------- | ----------- | ------------------ |
| **인프라**       | 직접 관리   | 포함               |
| **LangSmith**    | 불필요      | 필수 ($0~$400+/월) |
| **운영**         | 직접 운영   | 관리형             |
| **월 예상 비용** | $50~200+    | $0~400+            |

---

## 참고 자료

- [LangGraph Deployment Docs](https://langchain-ai.github.io/langgraph/cloud/deployment/)
- [LangSmith Platform](https://smith.langchain.com)
- [Docker Compose Reference](https://docs.docker.com/compose/)
