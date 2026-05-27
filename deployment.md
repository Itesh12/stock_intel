# Strategy Assistant Production Deployment Guide

This document details the production deployment requirements and architectures for the Strategy Assistant system.

---

## ⚠️ Vercel Deployment Constraint

> [!IMPORTANT]
> **Vercel Serverless Platform Limitation**
> Strategy Assistant background workers are **NOT** supported as persistent processes on the Vercel serverless runtime.
> Serverless functions are ephemeral, event-driven, and automatically shut down after a short execution timeout. They cannot run long-lived, stateful background loops (such as `setInterval` scanners or monitors).
>
> If you deploy to Vercel, the web application and REST APIs will function, but **all background workers (scanning, trade execution, and monitoring) will remain completely inactive.**

---

## Production Setup

For the automated trading scanners and assistants to execute successfully in a production environment, you must deploy two separate, co-operating processes:

```
                  ┌──────────────────────┐
                  │   MongoDB Database   │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌──────────────────────┐           ┌──────────────────────┐
│     API Process      │           │    Worker Process    │
│  (Next.js Web App)   │           │   (Worker Daemon)    │
│   e.g. npm start     │           │  e.g. npm run worker │
│  RUN_WORKERS=false   │           │  RUN_WORKERS=true    │
└──────────────────────┘           └──────────────────────┘
```

### 1. API Process (Web Server)
- **Command**: `npm start`
- **Environment**:
  - `RUN_WORKERS=false` (Ensures the web server handles API requests and server-side rendering, but does not start background trading loops).
  - `ENABLE_WORKER_RUNTIME=true`

### 2. Worker Process (Standalone Daemon)
- **Command**: `npm run worker`
- **Environment**:
  - `RUN_WORKERS=true` (Ensures the standalone process spins up the trading and monitor loops).
  - `ENABLE_WORKER_RUNTIME=true`

---

## Deployment Architectures

### Option A: PM2 (Virtual Private Server / VM)
You can use PM2 to manage both processes on a single VPS:
```bash
# Start the Next.js API server
pm2 start npm --name "stock-intel-api" -- start

# Start the Strategy Assistant worker daemon
RUN_WORKERS=true pm2 start npm --name "stock-intel-worker" -- run worker
```

### Option B: Docker Compose (Self-Hosted / VPS)
Create a multi-service container orchestration using Docker:
```yaml
version: '3.8'
services:
  api:
    build: .
    command: npm start
    ports:
      - "3000:3000"
    environment:
      - RUN_WORKERS=false
      - ENABLE_WORKER_RUNTIME=true
      - MONGO_URI=mongodb://db:27017/market

  worker:
    build: .
    command: npm run worker
    environment:
      - RUN_WORKERS=true
      - ENABLE_WORKER_RUNTIME=true
      - MONGO_URI=mongodb://db:27017/market
```

### Option C: PaaS (Railway / Render / Fly.io / etc.)
Set up two separate service deployments pointing to the same repository:
1. **Web Service**: Deploy the default branch with start command `npm start`, and environment variable `RUN_WORKERS=false`.
2. **Background Worker Service**: Deploy the same repository with start command `npm run worker`, and environment variable `RUN_WORKERS=true`.
