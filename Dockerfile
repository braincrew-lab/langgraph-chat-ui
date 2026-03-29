# ============================================================================
# LangGraph Chat UI — Multi-stage Dockerfile
# ============================================================================
# Build:  docker build -t langgraph-chat-ui .
# Run:    docker run -p 3000:3000 --env-file frontend/.env langgraph-chat-ui
# ============================================================================

# ---------- Stage 1: base ----------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable pnpm

# ---------- Stage 2: deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm install --frozen-lockfile --ignore-scripts

# ---------- Stage 3: builder ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY . .

ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

RUN cd frontend && node scripts/prisma-generate.mjs
RUN cd frontend && pnpm build

# ---------- Stage 4: runner ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server + static assets
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public

# Copy Prisma schema + DB scripts for runtime migration
COPY --from=builder --chown=nextjs:nodejs /app/frontend/prisma ./frontend/prisma
COPY --from=builder --chown=nextjs:nodejs /app/frontend/scripts ./frontend/scripts

# Install Prisma CLI globally for runtime migrations
RUN npm install -g prisma@5

# Entrypoint
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Data directory for uploads
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data
ENV UPLOAD_DIR=/app/data/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
