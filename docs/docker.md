# Docker Setup Guide

This guide explains how to run the Jernkorset webapp using Docker Compose.

## Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- Anthropic API key (for text modernization feature)

## Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Add your Anthropic API key to .env
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env

# 3. Start all services
docker compose up
```

Or use the Makefile shortcuts:
```bash
make setup    # Creates .env from template
make up       # Starts all services
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:8000 | FastAPI backend |
| Frontend | http://localhost:5173 | React dashboard (Vite dev) |
| Public Site | http://localhost:3000 | Next.js public website |

## Commands

### Starting Services

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Start only specific services
docker compose up api                 # API only
docker compose up api frontend        # API + React frontend
docker compose up api public-site     # API + Next.js site
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f frontend
```

### Stopping Services

```bash
# Stop all
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Rebuilding

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build api

# Rebuild and start
docker compose up --build
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                  (jernkorset-network)                    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │     API     │  │  Frontend   │  │   Public Site   │  │
│  │  (FastAPI)  │  │   (Vite)    │  │    (Next.js)    │  │
│  │   :8000     │  │   :5173     │  │     :3000       │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│         └────────────────┴───────────────────┘           │
│                          │                               │
│                    ┌─────┴─────┐                        │
│                    │   Data    │                        │
│                    │  (CSV)    │                        │
│                    └───────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Data Volumes

The API container mounts the data directory as read-only:
- Host: `./webapp/data/`
- Container: `/app/data/`

This allows the API to access the letter CSV files without copying them into the image.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude (text modernization) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | API URL for frontend |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API URL for public site |
| `PRODUCTION_API_URL` | `http://localhost:8000` | API URL for production build |

## Production Deployment

For production, use the nginx-based frontend:

```bash
# Build and run production stack
docker compose --profile production up -d
```

This starts:
- API on port 8000
- Nginx frontend on port 8080 (serving static React build)
- Public site on port 3000

### Production Configuration

1. Update `PRODUCTION_API_URL` in `.env` to your production API URL
2. Configure reverse proxy (nginx/Traefik) in front of services
3. Add SSL/TLS termination at the reverse proxy level

## Troubleshooting

### API fails to start

**Symptom**: API container exits immediately

**Solution**: Check that pandas is installed:
```bash
docker compose exec api pip list | grep pandas
```

### Frontend can't connect to API

**Symptom**: CORS errors or connection refused

**Solutions**:
1. Ensure API is healthy: `curl http://localhost:8000/letters`
2. Check API logs: `docker compose logs api`
3. Verify CORS is enabled in API (it is by default)

### Data not loading

**Symptom**: Empty letter list

**Solution**: Check data mount:
```bash
docker compose exec api ls -la /app/data/
```

Should show `placed_letters.csv` and `places_cleanup.csv`.

### Container won't build

**Solution**: Clear Docker cache:
```bash
docker compose build --no-cache
docker system prune -f
```

## Development Workflow

For active development, you can mix Docker and local services:

```bash
# Run API in Docker, frontend locally (faster HMR)
docker compose up api
cd webapp/frontend && npm run dev
```

Or run everything locally:
```bash
cd webapp/api && uvicorn main:app --reload
cd webapp/frontend && npm run dev
cd webapp/public-site && npm run dev
```

## Health Checks

The API container includes a health check that verifies the `/letters` endpoint responds:

```bash
# Check container health
docker compose ps

# Manual health check
curl http://localhost:8000/letters | head -c 100
```
