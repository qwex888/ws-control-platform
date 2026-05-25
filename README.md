# ws-control-platform

[中文文档 (README.zh-CN.md)](./README.zh-CN.md)

React + Vite + Node WebSocket gateway remote-control platform.

## Workspace Structure

- `apps/web` - React + Vite Web UI
- `apps/mobile` - React Native skeleton (future)
- `services/gateway` - Auth/API/WS gateway
- `packages/core` - Shared protocol/types/input mapping
- `packages/ui-tokens` - Shared UI tokens

## Requirements

- Node.js 20+
- pnpm 9+

## 1) Install

```bash
pnpm install
```

## 2) Environment Files

This project includes env templates at root:

- `.env.example` (generic template)
- `.env.development` (local development defaults)
- `.env.production.example` (production template)

For production, copy and edit:

```bash
cp .env.production.example .env.production
```

Start gateway in production mode:

```bash
pnpm --dir services/gateway start:prod
```

## 3) Run (Development)

Open two terminals from project root:

### Terminal A: start gateway

```bash
pnpm --dir services/gateway dev
```

> The gateway dev command automatically loads `../../.env.development` via `tsx --env-file`.

Gateway default listens on `http://127.0.0.1:13701`.

### Terminal B: start web

```bash
pnpm --dir apps/web dev --host 127.0.0.1 --port 4173
```

Open:

- Web UI: `http://127.0.0.1:4173`

## 4) Validation Commands

```bash
pnpm -r typecheck
pnpm -r test
pnpm --dir apps/web test:e2e
```

## 5) docker deploy

One-click command:

```bash
# Build + local deployment (default, no push remote)
./scripts/docker-deploy.sh all

# Or only deploy locally (skip push notifications)
SKIP_PUSH=1 ./scripts/docker-deploy.sh all
```

Completely released to the mirror warehouse

```bash
# Log in to the warehouse first
docker login ghcr.io   # or docker.io

# Build + deploy + push
DOCKER_REGISTRY=ghcr.io/your-username \
DOCKER_TAG=v1.0.0 \
./scripts/docker-deploy.sh all
```

## Production Environment Variables (NAS + FRP)

Set these on the gateway service process:

```bash
JWT_SECRET=<long-random-secret>
AUTH_USERNAME=<your-login-username>
AUTH_PASSWORD=<your-login-password>
COOKIE_SECURE=true
PORT=13701
NODE_ENV=production
```

## Security Baseline

Gateway includes:

- JWT auth with HttpOnly cookie
- CSRF token validation middleware for mutating device APIs
- Request schema validation with Zod
- Login/API rate limiting
- Per-user-scoped device config storage

## Device Config Behavior

- Device key: `serial + transportId`
- First connect: config required and persisted
- Later connects: persisted config auto-applied
- Config updates are permanent (no temporary override)

## Test Commands

```bash
pnpm --filter @wsctl/core test
pnpm --filter @wsctl/gateway test
pnpm --filter @wsctl/web test
pnpm --filter @wsctl/web typecheck
pnpm --dir apps/web test:e2e
```
