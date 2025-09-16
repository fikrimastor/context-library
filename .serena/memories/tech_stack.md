# MCP Context Library - Tech Stack

## Runtime & Framework
- **Runtime**: Cloudflare Workers with TypeScript
- **Framework**: Hono.js for HTTP routing
- **Node.js Compatibility**: Enabled via compatibility flags

## Database & Storage
- **Database**: Cloudflare D1 (SQLite) for persistent storage
- **Vector Search**: Cloudflare Vectorize for semantic similarity search
- **Vector Index**: `vectorize-context-library` with 1024 dimensions, cosine metric
- **Database Name**: `mcp-large-context`

## AI & State Management
- **AI**: Cloudflare Workers AI for text embeddings (`@cf/baai/bge-m3`)
- **State Management**: Cloudflare Durable Objects (`MyMCP` class)
- **MCP Implementation**: `@modelcontextprotocol/sdk` and `agents` framework

## Dependencies
### Core Dependencies
- `@modelcontextprotocol/sdk`: ^1.7.0
- `agents`: ^0.0.60
- `hono`: ^4.7.4
- `uuid`: ^11.1.0
- `zod`: ^3.24.2

### Dev Dependencies
- `@cloudflare/workers-types`: ^4.20250421.0
- `@types/node`: ^22.14.1
- `@types/uuid`: ^10.0.0
- `typescript`: ^5.5.2
- `workers-mcp`: ^0.1.0-3
- `wrangler`: ^4.6.0

## Cloudflare Services Required
- Workers (compute)
- D1 Database (persistent storage)
- Vectorize (vector search)
- Workers AI (embeddings)
- Durable Objects (state management)
- Assets (static file serving)
- Rate Limiting (100 req/minute)

## Configuration
- **TypeScript**: ES2021 target, strict mode enabled
- **Compatibility**: nodejs_compat flag enabled
- **Static Assets**: `./static/` directory served via Assets binding