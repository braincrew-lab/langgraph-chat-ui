# LangGraph Server Deployment Guide

This document explains two methods for deploying a LangGraph agent server to a production environment.

## Table of Contents

1. [Deployment Options Comparison](#deployment-options-comparison)
2. [Option A: Docker-Based Deployment](#option-a-docker-based-deployment)
3. [Option B: LangSmith-Based Deployment](#option-b-langsmith-based-deployment)
4. [Production Checklist](#production-checklist)

---

## Deployment Options Comparison

| Item                | Docker-Based           | LangSmith-Based         |
| ------------------- | ---------------------- | ----------------------- |
| **Infrastructure**  | Self-managed           | Fully managed           |
| **Cost**            | Infrastructure only    | LangSmith pricing       |
| **LangSmith Required** | Not required        | Required                |
| **Customization**   | Full control           | Platform limitations    |
| **Monitoring**      | Self-built             | Built into LangSmith    |
| **Recommended For** | Air-gapped, fully independent | Quick setup, managed preferred |

---

## Option A: Docker-Based Deployment

Build a fully independent environment with Docker Compose, without LangSmith.

### 1. Project Structure

```
langgraph-server/
├── src/
│   ├── agent/
│   │   └── graph.py          # LangGraph graph definition
│   └── security/
│       └── auth.py           # JWT verification handler
├── langgraph.json            # LangGraph configuration
├── pyproject.toml            # Python dependencies
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

### 4. Docker Image Build

```bash
# Install LangGraph CLI
pip install -U "langgraph-cli[inmem]"

# Build Docker image
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

### 6. Environment Variables (.env)

```env
# LLM
OPENAI_API_KEY=sk-...

# JWT Authentication (must be the same as Next.js AUTH_SECRET)
JWT_SECRET_KEY=your-secret-key-min-32-chars

# PostgreSQL
POSTGRES_PASSWORD=secure-password-here
```

### 7. Running

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f langgraph-api

# Health check
curl http://localhost:2024/health

# Stop
docker compose down
```

### 8. Cloud Deployment

#### AWS ECS

```bash
# ECR login
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin $ECR_URL

# Push image
docker tag my-agent:latest $ECR_URL/my-agent:latest
docker push $ECR_URL/my-agent:latest
```

Required infrastructure:

- **ECS Fargate** or **EC2**
- **RDS PostgreSQL**
- **ElastiCache Redis**

#### GCP Cloud Run

```bash
# Artifact Registry login
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# Push image
docker tag my-agent:latest asia-northeast3-docker.pkg.dev/$PROJECT/repo/my-agent:latest
docker push asia-northeast3-docker.pkg.dev/$PROJECT/repo/my-agent:latest
```

Required infrastructure:

- **Cloud Run**
- **Cloud SQL PostgreSQL**
- **Memorystore Redis**

---

## Option B: LangSmith-Based Deployment

A managed deployment using the LangSmith Platform.

### 1. LangSmith Account Setup

1. Sign up at [smith.langchain.com](https://smith.langchain.com) (free tier available)
2. **Settings** -> **API Keys** -> Generate key
3. Save the API key

### 2. LangGraph Cloud (Fully Managed)

Automatically deploys by connecting a GitHub repository.

#### Setup

1. Go to [smith.langchain.com](https://smith.langchain.com) -> **Deployments**
2. **New Deployment** -> Connect GitHub repository
3. Configure environment variables:
   - `OPENAI_API_KEY`
   - `JWT_SECRET_KEY`
4. Start deployment

After deployment is complete:

```
https://your-deployment-id.langgraph.app
```

### 3. Self-Hosted + LangSmith Monitoring

Self-host with Docker while using LangSmith tracing.

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
      LANGSMITH_API_KEY: ${LANGSMITH_API_KEY} # Added
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

#### Environment Variables

```env
# LangSmith
LANGSMITH_API_KEY=lsv2_pt_xxxxx

# LLM
OPENAI_API_KEY=sk-...

# JWT Authentication
JWT_SECRET_KEY=your-secret-key-min-32-chars

# PostgreSQL
POSTGRES_PASSWORD=secure-password
```

### 4. LangSmith Features

| Feature        | Description                                |
| -------------- | ------------------------------------------ |
| **Tracing**    | Track all LLM calls and agent executions   |
| **Monitoring** | Latency, token usage, error rates          |
| **Playground** | Test and debug graphs                      |
| **Datasets**   | Manage test datasets                       |
| **Evaluation** | Evaluate agent performance                 |

---

## Production Checklist

- [ ] Set `JWT_SECRET_KEY` to a random value of 32+ characters
- [ ] Enable HTTPS (nginx, traefik, or cloud load balancer)
- [ ] Configure CORS (allowed origins only)
- [ ] Apply rate limiting

### Infrastructure

- [ ] Set up PostgreSQL backups
- [ ] Configure Redis persistent storage (AOF)
- [ ] Set container resource limits (CPU, memory)
- [ ] Configure load balancer (multiple instances)

### Monitoring

- [ ] Monitor health check endpoint
- [ ] Set up log collection (CloudWatch, Stackdriver, ELK)
- [ ] Set up error tracking (Sentry)
- [ ] Set up metrics collection (Prometheus, Datadog)

---

## Cost Comparison

| Item              | Docker-Based | LangSmith Cloud    |
| ----------------- | ------------ | ------------------ |
| **Infrastructure**| Self-managed | Included           |
| **LangSmith**     | Not required | Required ($0~$400+/mo) |
| **Operations**    | Self-operated | Managed           |
| **Est. Monthly Cost** | $50~200+ | $0~400+           |

---

## References

- [LangGraph Deployment Docs](https://langchain-ai.github.io/langgraph/cloud/deployment/)
- [LangSmith Platform](https://smith.langchain.com)
- [Docker Compose Reference](https://docs.docker.com/compose/)
