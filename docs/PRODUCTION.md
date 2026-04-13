# Production Deployment

## Docker (Recommended)

### Basic: Chat UI + PostgreSQL

```bash
# 1. Configure
cp frontend/.env.example frontend/.env
# Edit frontend/.env — set AUTH_MODE, NEXT_PUBLIC_API_URL, etc.

# 2. Launch
docker compose up -d
```

The database is automatically initialized on first start. `NEXTAUTH_SECRET` is auto-generated if not set.

### Full Stack: Chat UI + LangGraph Server + PostgreSQL + Redis

```bash
# 1. Build your LangGraph server image
cd your-langgraph-project
langgraph build -t my-langgraph-api

# 2. Configure and launch
export LANGGRAPH_IMAGE=my-langgraph-api
docker compose -f docker-compose.full.yml up -d
```

### Environment Variables

See [Environment Variable Matrix](ENV_MATRIX.md) for a complete list per auth mode.

Key variables for Docker:
- `AUTH_MODE` — authentication mode
- `NEXT_PUBLIC_API_URL` — LangGraph server URL (from the browser's perspective)
- `LANGGRAPH_API_URL` — LangGraph server URL (Docker internal, e.g. `http://langgraph-api:8000`)
- `POSTGRES_PASSWORD` — PostgreSQL password (default: `chatui_secret`)

## Vercel

> SQLite is not supported on Vercel. You must use PostgreSQL.

1. Connect your repository on Vercel
2. Set environment variables:
   - `DATABASE_PROVIDER=postgresql`
   - `DATABASE_URL=postgresql://...` (Vercel Postgres or external)
   - `AUTH_MODE`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_API_URL`
3. Deploy

## Self-Hosted (without Docker)

```bash
# 1. Install and configure
pnpm install
cd frontend && cp .env.example .env
# Edit .env

# 2. Build
DATABASE_PROVIDER=postgresql pnpm build:production

# 3. Set up database
DATABASE_PROVIDER=postgresql pnpm db:setup

# 4. Start
pnpm start
```

For process management, use pm2:
```bash
pm2 start "cd frontend && pnpm start" --name chat-ui
```
