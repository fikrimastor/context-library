# MCP Context Library - Project Overview

## Project Purpose
MCP Context Library is a Model Context Protocol (MCP) Server that provides persistent memory capabilities for AI clients (Claude, Cursor, Windsurf). It enables AI clients to remember user preferences, behaviors, and context across conversations using vector search technology.

## Key Features
- **Memory Storage & Retrieval**: Store user information with semantic search
- **Document Management**: Store complex documents (PRDs, technical specs, journals) with intelligent parsing
- **Vector Search**: Uses Cloudflare Vectorize for similarity-based memory retrieval
- **Memory Restoration**: Sync missing memories from D1 database to Vectorize index
- **Advanced Search & Filtering**: Metadata filtering and type-based searches
- **Recent Activities**: Unified activity feed across different data types
- **Environment Configuration**: Dynamic server naming via MCP_NAME variable

## Architecture
- **Storage Flow**: Text → Workers AI (embeddings) → Vectorize (vectors) + D1 (text)
- **Search Flow**: Query → Workers AI (query vector) → Vectorize (similarity) → D1 (content)
- **MCP Flow**: Client requests → Durable Object → Utils → Cloudflare services

## Security
- Isolated namespaces per user in Vectorize
- Built-in rate limiting (100 req/min)
- Authentication based on userId only
- TLS encryption via Cloudflare

## Cost
Free tier allows 1,000 memories with ~28,000 queries per month using Cloudflare's free quotas.