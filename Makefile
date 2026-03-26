SHELL := /bin/bash
.ONESHELL:

UV ?= uv
DOCKER_COMPOSE ?= docker compose
API_PORT ?= 8000
FLOWER_PORT ?= 5555
REDIS_URL ?= redis://localhost:6379/0

export REDIS_URL

.PHONY: help install redis-up redis-down redis-logs api worker-docs worker-embed workers flower dev-stop check-api-port dev-all

help:
	@echo "Local development targets"
	@echo ""
	@echo "  make install       Install Python dependencies with uv"
	@echo "  make redis-up      Start Redis in Docker"
	@echo "  make redis-down    Stop Redis container"
	@echo "  make redis-logs    Tail Redis logs"
	@echo "  make api           Run FastAPI locally with reload"
	@echo "  make worker-docs   Run document-processing Celery worker locally"
	@echo "  make worker-embed  Run embedding/storage Celery worker locally"
	@echo "  make workers       Run both Celery workers locally"
	@echo "  make flower        Run Flower locally"
	@echo "  make dev-stop      Stop local API and Celery dev processes"
	@echo "  make dev-all       Start Redis in Docker, then run API and both workers locally"
	@echo ""
	@echo "Environment overrides"
	@echo "  API_PORT=$(API_PORT)"
	@echo "  FLOWER_PORT=$(FLOWER_PORT)"
	@echo "  REDIS_URL=$(REDIS_URL)"

install:
	$(UV) sync

redis-up:
	$(DOCKER_COMPOSE) up -d redis

redis-down:
	$(DOCKER_COMPOSE) stop redis

redis-logs:
	$(DOCKER_COMPOSE) logs -f redis

api:
	$(UV) run uvicorn app.main:app --reload --host 0.0.0.0 --port $(API_PORT)

worker-docs:
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=1 \
		--queues=document_processing \
		--pool=solo \
		--hostname=document_worker@%h

worker-embed:
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=4 \
		--queues=embedding,storage \
		--pool=prefork \
		--hostname=embedding_worker@%h

workers:
	trap 'kill 0' SIGINT SIGTERM EXIT
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=1 \
		--queues=document_processing \
		--pool=solo \
		--hostname=document_worker@%h &
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=4 \
		--queues=embedding,storage \
		--pool=prefork \
		--hostname=embedding_worker@%h &
	wait

flower:
	$(UV) run celery -A app.workers.celery_app flower --port=$(FLOWER_PORT)

dev-stop:
	ps -eo pid=,args= | grep -F "/.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port $(API_PORT)" | grep -v grep | awk '{print $$1}' | xargs -r kill
	ps -eo pid=,args= | grep -F "/.venv/bin/celery -A app.workers.celery_app worker --loglevel=info --concurrency=1 --queues=document_processing --pool=solo --hostname=document_worker@" | grep -v grep | awk '{print $$1}' | xargs -r kill
	ps -eo pid=,args= | grep -F "/.venv/bin/celery -A app.workers.celery_app worker --loglevel=info --concurrency=4 --queues=embedding,storage --pool=prefork --hostname=embedding_worker@" | grep -v grep | awk '{print $$1}' | xargs -r kill

check-api-port:
	if lsof -tiTCP:$(API_PORT) -sTCP:LISTEN >/dev/null 2>&1; then
		echo "Port $(API_PORT) is already in use."
		echo "Run 'make dev-stop' to stop the previous dev stack or set a different API_PORT."
		exit 1
	fi

dev-all:
	$(DOCKER_COMPOSE) up -d redis
	$(MAKE) check-api-port
	trap 'kill 0' SIGINT SIGTERM EXIT
	$(UV) run uvicorn app.main:app --reload --host 0.0.0.0 --port $(API_PORT) &
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=1 \
		--queues=document_processing \
		--pool=solo \
		--hostname=document_worker@%h &
	$(UV) run celery -A app.workers.celery_app worker \
		--loglevel=info \
		--concurrency=4 \
		--queues=embedding,storage \
		--pool=prefork \
		--hostname=embedding_worker@%h &
	wait
