# Jernkorset - Development Commands
# Run `make help` to see available commands

.PHONY: help up down logs build clean api frontend public-site prod test

# Default target
help:
	@echo "Jernkorset - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Docker Commands:"
	@echo "  up              Start all services (api, frontend, public-site)"
	@echo "  up-api          Start only the API service"
	@echo "  up-frontend     Start API + frontend"
	@echo "  up-public       Start API + public-site"
	@echo "  down            Stop all services"
	@echo "  logs            Follow logs from all services"
	@echo "  build           Build all Docker images"
	@echo "  clean           Stop services and remove volumes"
	@echo ""
	@echo "Production:"
	@echo "  prod            Start production stack (nginx frontend)"
	@echo ""
	@echo "Development:"
	@echo "  api             Start API in local Python (no Docker)"
	@echo "  frontend        Start frontend in local Node (no Docker)"
	@echo "  public-site     Start public-site in local Node (no Docker)"
	@echo ""
	@echo "Setup:"
	@echo "  setup           Copy .env.example to .env"
	@echo "  check           Verify environment is configured"

# =============================================================================
# Docker Commands
# =============================================================================

up:
	docker compose up

up-api:
	docker compose up api

up-frontend:
	docker compose up api frontend

up-public:
	docker compose up api public-site

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# Production with nginx frontend
prod:
	docker compose --profile production up

# =============================================================================
# Local Development (without Docker)
# =============================================================================

api:
	cd webapp/api && uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd webapp/frontend && npm run dev

public-site:
	cd webapp/public-site && npm run dev

# =============================================================================
# Setup
# =============================================================================

setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
		echo "Please edit .env and add your ANTHROPIC_API_KEY"; \
	else \
		echo ".env already exists"; \
	fi

check:
	@echo "Checking environment..."
	@if [ -f .env ]; then \
		echo "✓ .env file exists"; \
	else \
		echo "✗ .env file missing (run: make setup)"; \
	fi
	@if grep -q "ANTHROPIC_API_KEY=sk-ant-" .env 2>/dev/null; then \
		echo "✓ ANTHROPIC_API_KEY appears to be set"; \
	else \
		echo "⚠ ANTHROPIC_API_KEY may not be configured"; \
	fi
	@echo ""
	@echo "Checking Docker..."
	@docker --version || echo "✗ Docker not installed"
	@docker compose version || echo "✗ Docker Compose not installed"

# =============================================================================
# Testing
# =============================================================================

test-api:
	cd webapp/api && python -m pytest

test:
	@echo "Running all tests..."
	$(MAKE) test-api
