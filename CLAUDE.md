# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MCP Context Library** is a Model Context Protocol (MCP) Server built on Cloudflare's infrastructure that provides persistent memory capabilities for AI clients (Claude, Cursor, Windsurf). It enables AI clients to remember user preferences, behaviors, and context across conversations using vector search technology.

## Tech Stack

- **Runtime**: Cloudflare Workers with TypeScript
- **Framework**: Hono.js for HTTP routing
- **Database**: Cloudflare D1 (SQLite) for persistent storage
- **Vector Search**: Cloudflare Vectorize for semantic similarity search
- **AI**: Cloudflare Workers AI for text embeddings (`@cf/baai/bge-m3`)
- **State Management**: Cloudflare Durable Objects (`MyMCP` class)
- **MCP Implementation**: `@modelcontextprotocol/sdk` and `agents` framework
- **Static Assets**: Served via Cloudflare Assets binding

## Development Commands

```bash
# Development server with Vectorize binding
npm run dev

# Alternative dev command
npm start

# Deploy to Cloudflare
npm run deploy

# Code formatting (Biome)
npm run format

# Linting with auto-fix (Biome)
npm run lint:fix

# Generate TypeScript types from Wrangler config
npm run cf-typegen
```

## Code Architecture

### Core Components

1. **src/index.ts** - Main Hono application with REST API routes:
   - Static file serving (`/`, `/memories`)
   - Memory CRUD operations (`/:userId/memories/*`)
   - Memory restoration endpoint (`/:userId/memories/restore`)

2. **src/mcp.ts** - Durable Object implementing MCP Server:
   - `MyMCP` class handles MCP protocol communication
   - Manages memory storage, search, and retrieval via MCP tools
   - Integrates with D1 and Vectorize through utility functions

3. **src/utils/db.ts** - D1 database operations:
   - Memory CRUD operations
   - Recent activities retrieval
   - Database initialization

4. **src/utils/vectorize.ts** - Vector operations:
   - Text embedding generation using Workers AI
   - Vector storage and similarity search
   - Memory restoration functionality with metadata filtering

### Data Flow

1. **Storage**: Text → Workers AI (embeddings) → Vectorize (vectors) + D1 (text)
2. **Search**: Query → Workers AI (query vector) → Vectorize (similarity) → D1 (content)
3. **MCP**: Client requests → Durable Object → Utils → Cloudflare services

### Environment Configuration

- `MCP_NAME`: Configurable server name (default: "MCP Context Library")
- Vectorize index: `vectorize-context-library`
- D1 database: `mcp-large-context`

## Code Style & Conventions

- **Formatter**: Biome with 4-space indentation, 100-character line width
- **TypeScript**: Strict mode enabled, ES2021 target
- **Error Handling**: Try-catch blocks with console logging
- **Naming**: camelCase for functions/variables, PascalCase for classes
- **Async**: All external service calls are async/await
- **Rate Limiting**: 100 requests/minute via Cloudflare binding

## Infrastructure Dependencies

**Required Cloudflare Services:**
- Workers (compute)
- D1 Database (persistent storage)
- Vectorize (vector search)
- Workers AI (embeddings)
- Durable Objects (state management)
- Assets (static file serving)

**Wrangler Configuration:**
- Main entry: `src/index.ts`
- Node.js compatibility enabled
- Migrations configured for Durable Objects

## Key Features

- **Memory Restoration**: Sync missing memories from D1 to Vectorize
- **Metadata Filtering**: Enhanced search with type-based filters
- **Recent Activities**: Unified view of memories and journals
- **Environment Configuration**: Dynamic naming via environment variables
- **Rate Limiting**: Built-in protection against abuse