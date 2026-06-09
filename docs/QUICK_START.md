# Quick Start (5 minutes)

The fastest way to get LangGraph Chat UI running locally with no authentication.

## Prerequisites

- Node.js 22.13+, pnpm 10+ (the project pins pnpm 11.5.2)
- A LangGraph server running (e.g. `langgraph dev`)

## Steps

```bash
git clone https://github.com/teddynote-lab/langgraph-chat-ui.git
cd langgraph-chat-ui
pnpm install
pnpm launch   # interactive setup — select "standalone" mode
```

If pnpm is unavailable or does not use the pinned version, run `corepack enable` and retry.

Or manually:

```bash
cd frontend
cp .env.example .env
# Edit .env: set NEXT_PUBLIC_API_URL to your LangGraph server
pnpm dev
```

Open http://localhost:3000.

## What's next

- Add authentication: see [Integration Guide](INTEGRATION.md)
- Deploy to production: see [Production Deployment](PRODUCTION.md)
