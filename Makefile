# Jernkorset - Development Commands
# Run `make help` to see available commands

.PHONY: help up down logs build clean admin frontend public-site prod test

# Default target
help:
	@echo "Jernkorset - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Docker Commands:"
	@echo "  up              Start all services (admin, public-site)"
	@echo "  up-admin        Start the admin app"
	@echo "  up-public       Start admin + public-site"
	@echo "  down            Stop all services"
	@echo "  logs            Follow logs from all services"
	@echo "  build           Build all Docker images"
	@echo "  clean           Stop services and remove volumes"
	@echo ""
	@echo "Development:"
	@echo "  admin           Start admin app locally (Express + Vite)"
	@echo "  admin-server    Start admin backend only"
	@echo "  frontend        Start frontend dev server only"
	@echo "  public-site     Start public-site in local Node (no Docker)"
	@echo ""
	@echo "Testing:"
	@echo "  test-e2e        Run E2E tests via Docker"
	@echo ""
	@echo "Data Pipeline:"
	@echo "  audit           Run text quality audit"
	@echo "  correct         Apply text corrections"
	@echo "  normalize       Normalize Danish text"
	@echo "  validate        Validate text quality"
	@echo "  pipeline-data   Run full data pipeline"

# =============================================================================
# Docker Commands
# =============================================================================

up:
	docker compose up

up-admin:
	docker compose up admin

up-public:
	docker compose up admin website

down:
	docker compose down

logs:
	docker compose logs -f

build:
	GIT_SHA=$$(git rev-parse --short HEAD) BUILD_DATE=$$(date +%Y-%m-%d) docker compose build

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# =============================================================================
# Local Development (without Docker)
# =============================================================================

admin:
	cd apps/admin && npm run dev

admin-server:
	cd apps/admin && npm run dev:server

frontend:
	cd apps/admin/frontend && npm run dev

public-site:
	cd apps/website && npm run dev

# =============================================================================
# Setup
# =============================================================================

setup:
	@if [ ! -f .env ]; then \
		echo "ADMIN_API_KEY=" > .env; \
		echo "Created .env — set ADMIN_API_KEY for production auth"; \
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
	@echo ""
	@echo "Checking Docker..."
	@docker --version || echo "✗ Docker not installed"
	@docker compose version || echo "✗ Docker Compose not installed"

# =============================================================================
# Testing
# =============================================================================

test-e2e:
	docker compose run --rm e2e

# =============================================================================
# Data Quality Pipeline
# =============================================================================

audit:
	python scripts/audit-text-quality.py

correct:
	python scripts/apply-corrections.py

normalize:
	node scripts/normalize-danish.mjs

validate:
	python scripts/validate-text-quality.py

pipeline-data: audit correct normalize validate
	@echo "Data quality pipeline complete."
