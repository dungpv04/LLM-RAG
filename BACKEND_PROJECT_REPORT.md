# Backend Project Report

Scope: this report covers the whole repository except the `frontend/` folder. It is based on static code reading of the backend, workers, scripts, tests, models, configuration, and Supabase migrations.

## Executive Summary

This project is a Python-based Retrieval-Augmented Generation (RAG) system that was originally built to answer questions about Vietnam's Power Development Plan VIII (PDP8), but the repository has already started expanding into a broader legal and regulatory document corpus.

At its core, the system:

- ingests PDF documents,
- extracts structured markdown from them with an LLM-assisted PDF parser,
- semantically chunks the content,
- embeds the chunks with Gemini embeddings,
- stores them in Supabase/Postgres with pgvector-compatible vector types,
- retrieves relevant chunks with optional reranking,
- and generates cited answers through DSPy-driven RAG pipelines.

The strongest implemented path is the asynchronous worker pipeline driven by Celery. The repo also contains a synchronous document-upload service and a few legacy/test paths, but those are not fully aligned with the current core pipeline.

## Main Goal

The main business goal is to provide a question-answering and document-analysis backend over a curated corpus of Vietnamese planning or legal documents.

There are really two layers of intent in the repo:

1. Original product intent:
   a PDP8 document analysis assistant for electricity-planning questions.

2. Current repository direction:
   a more general regulation RAG platform. The `uploads/` folder now contains not only PDP8 files, but also Land Law and Investment Law PDFs, and there is a script dedicated to processing all regulation PDFs except the PDP8 set.

Because of that, the repo is best described as:

> a regulation-focused RAG backend whose naming, prompts, and some documentation still strongly reflect its PDP8 origin.

## Technology Stack

### API and app runtime

- FastAPI for the HTTP API
- Uvicorn and Gunicorn for serving
- Pydantic and `pydantic-settings` for schemas and environment settings
- YAML config via `config.yaml`

### AI / RAG pipeline

- DSPy for prompt-programming and RAG module composition
- Google Gemini for generation and embeddings
- Marker PDF for LLM-assisted PDF extraction to markdown
- Chonkie `SemanticChunker` for semantic chunking
- `sentence-transformers` CrossEncoder for reranking
- PyTorch as the model runtime under the reranker stack

### Data and infrastructure

- Supabase client for database and storage access
- PostgreSQL + pgvector-style similarity search via Supabase RPC
- `halfvec(3072)` in the database for embeddings
- Redis for:
  - Celery broker/result backend
  - chat session persistence
  - rate limiting
  - circuit breaker state
  - distributed locks
  - Gemini cache-name registry
- Celery for asynchronous document processing

### Packaging and deployment

- `uv` for dependency installation and execution
- Docker and Docker Compose for containerized deployment

## High-Level Architecture

The backend is organized around a fairly clean service-oriented structure:

- `app/main.py`
  FastAPI startup, CORS, router registration, and startup warmup.
- `app/core/`
  typed app config and environment settings.
- `app/db/`
  Supabase/Redis dependencies plus repository classes.
- `app/routers/` and `app/api/`
  HTTP endpoints for RAG, documents, and chat.
- `app/services/`
  domain logic:
  - document management
  - PDF extraction
  - embeddings
  - retrieval
  - reranking
  - RAG orchestration
  - chat sessions
  - storage
- `app/workers/`
  Celery app, tasks, and resilience middleware.
- `supabase/migrations/`
  schema, vector function, storage bucket, and processing-status setup.
- `scripts/`
  ingestion, training, inspection, benchmarking, and worker-start utilities.

## Runtime Logic

### 1. Application startup

At startup, the backend:

- configures DSPy globally,
- creates the FastAPI app,
- enables permissive CORS,
- and tries to pre-initialize the RAG service to reduce first-request latency.

This warmup is useful because the RAG path loads expensive dependencies such as the reranker and embedding stack.

### 2. Document ingestion flow

There are two ingestion implementations in the repo.

#### A. Worker-based ingestion (the strongest and most coherent path)

This is the asynchronous pipeline used by the Celery tasks:

1. upload PDF to Supabase Storage
2. extract markdown from PDF with Marker
3. chunk semantically while preserving page information and tables
4. fan out embedding jobs per chunk
5. store each chunk + embedding in Supabase
6. fan in to finalize the document-processing status

This path is implemented across:

- `app/workers/tasks/document.py`
- `app/workers/tasks/embedding.py`
- `app/workers/tasks/storage.py`
- `app/services/pdf_processor/processor.py`
- `app/services/storage/service.py`
- `app/db/processing_status.py`

It also includes operational protection:

- distributed locks
- circuit breakers
- token-bucket rate limiting

#### B. Synchronous upload service

The API also exposes synchronous upload endpoints through `DocumentService`, intended to:

- receive file bytes or a file path,
- upload the PDF,
- process it immediately,
- create embeddings,
- and insert chunks directly.

Conceptually this is a simpler synchronous version of ingestion, but in the current codebase it is out of sync with the real PDF-processing interface and the storage bucket configuration.

### 3. Retrieval and answer generation flow

For a query, the main RAG flow is:

1. embed the query
2. retrieve candidate chunks
3. optionally rerank them
4. choose a RAG strategy
5. build a numbered context block
6. generate a cited answer
7. return source chunks, page ranges, and strategy metadata

There are three RAG modes:

- `single-hop`
- `multi-hop`
- `adaptive`

The adaptive mode is the default in `config.yaml`, and it decides whether the query is simple or complex before selecting single-hop or multi-hop reasoning.

### 4. Chat flow

The chat API stores message history in Redis:

- each session gets a UUID,
- messages are appended to Redis lists,
- metadata is stored separately,
- TTL is refreshed as the session stays active.

The chat layer supports:

- regular request/response chat
- SSE streaming chat
- chat history retrieval
- session reset and deletion

### 5. Cache-accelerated flow

For explicit document-filtered streaming queries, the backend can create a Gemini cached context from all chunks of one or a few selected documents, then use that cache to speed up generation. Retrieval still runs in parallel to provide source attribution back to the frontend.

## Core Logic by Module

### `app/services/pdf_processor/processor.py`

This module is the document-understanding foundation.

Responsibilities:

- convert PDF to markdown with Marker
- preserve layout and tables
- semantically chunk the text
- protect markdown tables before chunking, then restore them
- infer page boundaries
- attach `pages` and `page_range` metadata to chunks

This is one of the most important modules in the repo because it controls how much structure survives ingestion.

### `app/services/embedding/service.py`

This service wraps Gemini embeddings.

Responsibilities:

- single-text embeddings
- query embeddings
- batch embeddings

Although the config file mentions multi-LLM support, the current runtime implementation here is Gemini-specific.

### `app/services/rag/retrieval.py`

This module implements the retrieval strategy.

It supports:

- direct filtered retrieval for one or more named documents
- full-corpus retrieval when no filter is provided
- optional reranking

For unfiltered search, it uses a two-stage strategy:

1. quick scan:
   score all documents by a small number of top chunks.
2. deep scan:
   retrieve more chunks only from the top-N documents.
3. rerank:
   use a cross-encoder to improve final relevance.

This is a practical optimization for multi-document corpora because it avoids reranking hundreds of chunks from the whole dataset every time.

### `app/services/rag/dspy_rag.py`

This is the single-hop RAG module.

Responsibilities:

- retrieve chunks
- format numbered context
- run a DSPy `ChainOfThought` answer generator
- attach retrieved chunks back onto the prediction

### `app/services/rag/multihop_rag.py`

This is the complex-query path.

Responsibilities:

- iteratively generate new search queries from gathered context
- retrieve multiple times
- accumulate context across hops
- produce a final answer from the combined evidence

### `app/services/rag/adaptive_rag.py`

This module adds a decision layer on top of the other two:

- assess whether the question is simple or complex
- prefer single-hop for narrow document-filtered questions
- otherwise route between single-hop and multi-hop

### `app/services/rag/service.py`

This is the orchestration layer used by APIs.

Responsibilities:

- initialize retrieval and caching services
- select the configured RAG mode
- run query and query-stream paths
- format the final API response payload
- attach strategy metadata and source snippets

### `app/workers/`

The workers are designed as a distributed ingestion pipeline, not just background helpers.

Key roles:

- `celery_app.py`
  task routing and worker settings.
- `tasks/document.py`
  orchestration and chunk fan-out.
- `tasks/embedding.py`
  embedding generation and DB insert.
- `tasks/storage.py`
  final status update.
- middleware
  distributed lock, rate limiter, and circuit breaker helpers.

## Data Model

### Documents table

The `documents` table stores:

- `document_name`
- `chunk_id`
- `content`
- `embedding`
- `metadata`
- `pages`
- `page_range`

Retrieval uses the `match_documents` SQL function exposed through Supabase RPC.

### Processing status table

The `document_processing_status` table tracks:

- pending / processing / completed / failed state
- Celery task id
- total and processed chunks
- error message
- timestamps

This enables scripts and services to poll ingestion progress.

### Storage

Supabase Storage is used to hold the original PDFs separately from the chunk data stored in the `documents` table.

## Main Features

### Features that are clearly implemented

- LLM-assisted PDF to markdown extraction
- semantic chunking with table preservation
- page-aware source attribution
- vector retrieval over document chunks
- two-stage multi-document retrieval
- cross-encoder reranking
- adaptive single-hop vs multi-hop answering
- Redis-backed chat sessions
- SSE streaming responses
- asynchronous document processing with Celery
- document-processing progress tracking
- Gemini cached-context acceleration for filtered queries
- DSPy training/optimization workflow with saved artifacts

### Features that are partially implemented or drifting

- multi-LLM support:
  present in docs/config wording, but most live code paths are Gemini-only.
- synchronous document upload:
  exposed through API, but not aligned with the active PDF pipeline.
- cache management API:
  implemented as a router file, but not wired into the FastAPI app.

## Non-Frontend Repository Structure

### `app/`

- `main.py`
  app factory and startup warmup
- `core/`
  typed config loading
- `db/`
  Supabase/Redis and repository layer
- `routers/`
  document and RAG HTTP routes
- `api/`
  chat API and cache API
- `schemas/`
  Pydantic request/response models
- `services/`
  business logic
- `workers/`
  background ingestion pipeline
- `training/`
  RAG Q&A examples

### `scripts/`

The scripts reveal intended operational workflows:

- processing:
  `process_pdp8.py`, `process_all_regulations.py`
- querying:
  `query_rag.py`
- training:
  `train_rag.py`, `train_multihop_rag.py`
- caching:
  `cache_all_documents.py`
- diagnostics:
  `test_retrieval.py`, `test_unique_content.py`, `inspect_content.py`, `compare_structure.py`, `test_streaming_time.py`
- worker startup:
  `start_worker.sh`, `start_embedding_workers.sh`, `start_all_workers.sh`
- maintenance:
  circuit-breaker reset scripts

### `models/`

Contains saved DSPy artifacts:

- `optimized_rag.json`
- `optimized_multihop_rag.json`

These are not traditional ML weights. They are saved optimized DSPy module states and demos.

### `supabase/`

Contains:

- local Supabase config
- migrations for:
  - documents table
  - embedding dimension upgrade
  - storage bucket
  - page metadata
  - processing status table
  - retrieval SQL function

### `tests/`

The tests are more like executable integration scripts than isolated unit tests. They rely on real infrastructure and some of them have drifted behind the current service interfaces.

## Important Architectural Observations

### 1. The repository has broadened beyond PDP8

Signals of expansion:

- `uploads/` contains 35 PDFs, many of them Land Law and Investment Law documents.
- `scripts/process_all_regulations.py` explicitly processes all regulation PDFs except the PDP8 files.

But many prompts and model instructions still frame the assistant as a PDP8 or electricity-plan expert.

Impact:

- the product naming and prompt layer no longer fully match the corpus.
- this may bias generated answers when the indexed documents are outside the power-planning domain.

### 2. The real production ingestion path is the worker pipeline

The Celery orchestration is the most complete and internally consistent document pipeline in the repo. If this system is running successfully in practice, it is likely because the worker path is carrying the ingestion workload, not the synchronous `DocumentService` path.

### 3. The codebase contains both active and legacy paths

Examples:

- `app/api/cache.py` exists but is not registered in `app/main.py`
- `app/routers/router.py` is empty
- `app/services/rag/dspy_modules.py` looks like an older simplified RAG module
- several tests/scripts still use older method names or assumptions

## Mismatches, Risks, and Current Gaps

| Area | Intended behavior | Actual state in code | Impact |
| --- | --- | --- | --- |
| Synchronous document upload | API uploads should process and index PDFs immediately | `DocumentService.upload_document()` calls `process_pdf()` as if it returned chunks, but `PDFProcessor.process_pdf()` returns `(markdown, metadata)` and chunking now lives in `chunk_text_with_pages()` | `/documents/upload/file` and `/documents/upload/path` are likely broken |
| Storage bucket naming | one shared bucket for PDFs | worker/storage service uses `pdfs`, but `DocumentService` defaults to `documents` | sync upload/delete path likely targets the wrong bucket |
| Single-document query filtering | `document_name` should scope retrieval to one document | `RAGService.query()` ignores `document_name` unless `doc_names` is used; `/chat/stream` also accepts `document_name` but does not pass it through | main `/rag/query` and non-doc chat endpoints do not actually filter the way the schema suggests |
| RAG singleton ownership | one warmed RAG service per process | `app/main.py` warms `app.services.rag.dependencies.get_rag_service()`, but `app/routers/rag.py` creates its own separate module-level singleton | duplicate heavy initialization and inconsistent shared state |
| Cache management API | external cache warmup/status/clear endpoints should be usable | `app/api/cache.py` is not mounted in `app/main.py` | cache API is effectively unreachable |
| Cache deletion | cache clear should remove Gemini caches | `GeminiCacheService.delete_cache()` checks a local `_cache_registry`, but cache creation only persists names to Redis and never fills that dict | delete/clear operations will usually fail |
| Tests and task config | support scripts should match live interfaces | `tests/test_pdf_processing.py` still calls missing `chunk_text()`, and Celery annotations refer to `generate_embedding_task` instead of `generate_embedding_and_store_task` | test drift and some config options do not affect the real task |
| Domain alignment | broader regulation corpus should get broader prompts | single-hop, multi-hop, and cache prompts still describe the assistant as a PDP8 / electricity-plan expert | answer style may be biased when querying Land Law or Investment Law content |

## Key File References for the Gaps

- Sync upload mismatch:
  `app/services/documents/service.py`
  `app/services/pdf_processor/processor.py`
- Bucket mismatch:
  `app/services/documents/service.py`
  `app/services/storage/service.py`
  `supabase/migrations/20251117085213_setup_storage_for_pdfs.sql`
- `document_name` filter mismatch:
  `app/routers/rag.py`
  `app/schemas/rag.py`
  `app/services/rag/service.py`
  `app/api/chat.py`
- Duplicate RAG singleton:
  `app/main.py`
  `app/routers/rag.py`
  `app/services/rag/dependencies.py`
- Unmounted cache router:
  `app/main.py`
  `app/api/cache.py`
- Broken cache deletion:
  `app/services/rag/gemini_cache.py`
- Outdated test path:
  `tests/test_pdf_processing.py`

## Bottom Line

This is a serious backend RAG project with a solid architectural spine:

- FastAPI API layer
- Celery ingestion workers
- Redis-backed operational controls
- Supabase vector storage
- DSPy-driven adaptive RAG
- reranking and streaming

Its strongest logic is in:

- PDF extraction and semantic chunking
- worker-based ingestion
- retrieval and adaptive answer generation

Its main weaknesses today are not the core idea, but alignment issues between parallel code paths:

- synchronous upload vs worker upload
- documented filtering vs real filtering
- PDP8-specific prompts vs broader regulation corpus
- mounted APIs vs unmounted helper routers
- older tests/scripts vs newer service interfaces

If you want to continue this project, the backend is already structurally strong enough to evolve into a reusable regulation-analysis platform. The next step should be consolidating the duplicate paths so there is one canonical ingestion flow, one canonical RAG service instance, and one clear domain model for the corpus.
