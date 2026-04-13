#!/bin/sh
set -e

# Auto-generate NEXTAUTH_SECRET if not provided
if [ -z "$NEXTAUTH_SECRET" ]; then
  export NEXTAUTH_SECRET=$(openssl rand -hex 32)
  echo "[entrypoint] Auto-generated NEXTAUTH_SECRET (set explicitly for production)"
fi

# Run database setup if DATABASE_URL is configured
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] Running database setup..."
  cd /app/frontend
  node scripts/db-setup.mjs
  cd /app
fi

# Start the Next.js server
echo "[entrypoint] Starting server on port ${PORT:-3000}..."
exec node frontend/server.js
