# QWEN.md - MCP Context Library

## Project Overview

**MCP Context Library** is a Model Context Protocol (MCP) Server that enables AI clients (Cursor, Claude, Windsurf, etc.) to remember user information, preferences, and behaviors across conversations. It uses vector search technology (RAG) to find relevant memories based on semantic meaning rather than just keywords.

### Core Technologies
- **Runtime**: Cloudflare Workers with TypeScript
- **Framework**: Hono.js for HTTP routing
- **Database**: Cloudflare D1 (SQLite) for persistent storage
- **Vector Search**: Cloudflare Vectorize for semantic similarity search
- **AI**: Cloudflare Workers AI for text embeddings (`@cf/baai/bge-m3`)
- **State Management**: Cloudflare Durable Objects (`MyMCP` class)
- **MCP Implementation**: `@modelcontextprotocol/sdk` and `agents` framework
- **Static Assets**: Served via Cloudflare Assets binding

### Architecture
The system stores memories in two places for redundancy and performance:
1. **Cloudflare D1**: Persistent storage of original text and metadata
2. **Cloudflare Vectorize**: Vector embeddings for fast semantic search

When retrieving memories:
1. Queries are converted to vectors using Workers AI
2. Vectorize performs similarity search
3. D1 provides the original text for matched vectors
4. Results are ranked by similarity score

## Development Environment

IMPORTANT: **MUST** use subagent_type="javascript-pro" to execute task.

### Prerequisites
- Node.js (version specified in package.json)
- npm or yarn
- Cloudflare account with required services:
  - Workers
  - D1 Database
  - Vectorize
  - Workers AI
  - Durable Objects

### Setup Commands
```bash
# Install dependencies
npm install

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

### Project Structure
```
├── src/
│   ├── index.ts          # Main Hono application with REST API routes
│   ├── mcp.ts            # Durable Object implementing MCP Server
│   └── utils/
│       ├── db.ts         # D1 database operations
│       └── vectorize.ts  # Vector operations and embeddings
├── static/
│   ├── index.html        # Main setup page with configuration instructions
│   └── memories.html     # Memory management interface
├── package.json          # Dependencies and scripts
├── wrangler.jsonc        # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
├── biome.json            # Code formatting and linting configuration
├── CLAUDE.md             # Guidance for Claude Code (claude.ai/code)
└── README.md             # Project documentation
```

## Building and Running

### Local Development
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
   - This starts a local development server with Vectorize binding
   - Access the interface at `http://localhost:8787`

### Deployment
1. Deploy to Cloudflare: `npm run deploy`
   - This deploys the worker to your Cloudflare account
   - Requires proper Cloudflare credentials and configuration

### Configuration
The project requires several Cloudflare services to be configured:
- **Vectorize Index**: `vectorize-context-library` (1024 dimensions, cosine metric)
- **D1 Database**: `mcp-large-context`
- **Workers AI Binding**: For text embeddings
- **Durable Objects**: `MyMCP` class for state management

Environment variables:
- `MCP_NAME`: Configurable server name (default: "MCP Context Library")

## Key Features

### Memory Management
- **Storage**: Text is processed by Cloudflare Workers AI to generate embeddings, stored in both Vectorize and D1
- **Retrieval**: Queries are converted to vectors for semantic search, with results ranked by similarity
- **CRUD Operations**: Create, read, update, and delete memories through REST API endpoints

### Artifact Management
- **Document Storage**: Store complex documents (PRDs, technical specs, journals) with intelligent parsing
- **Sectioning**: Automatically breaks large documents into searchable sections with metadata
- **Reconstruction**: Reassemble complete documents from stored sections
- **Search**: Advanced search with filtering by document type, project, tags, and priority

### Memory Restoration
- **Sync**: Restore missing memories from D1 database to Vectorize index
- **Data Integrity**: Ensures consistency between persistent storage and vector search
- **Recovery Tools**: Built-in restoration functionality for missing vector embeddings

### Rate Limiting
- Built-in rate limiting (100 requests/minute) to prevent abuse
- Configurable in `wrangler.jsonc`

## Development Conventions

### Code Style
- **Formatter**: Biome with 4-space indentation, 100-character line width
- **TypeScript**: Strict mode enabled, ES2021 target
- **Error Handling**: Try-catch blocks with console logging
- **Naming**: camelCase for functions/variables, PascalCase for classes
- **Async**: All external service calls are async/await

### Testing
The project currently lacks formal tests. When adding tests:
- Use Cloudflare's testing patterns for Workers
- Test both REST API endpoints and MCP functionality
- Consider edge cases in vector search and database operations

### Documentation
- Keep README.md updated with any new features or changes
- Update CLAUDE.md when adding guidance for Claude Code
- Document new API endpoints in the code with JSDoc comments

## MCP Tools

The MCP Context Library provides several tools for AI clients:

### Core Memory Tools
- `add_to_memory`: Store important user information for future sessions
- `search_memory`: Retrieve relevant memories using semantic search

### Advanced Document Management
- `remember_artifact`: Store complex documents with intelligent parsing
- `search_artifacts`: Advanced search with filtering options
- `reconstruct_artifact`: Reassemble complete documents from sections
- `list_artifacts_by_project`: Browse all documents for a project

## API Endpoints

### REST API (src/index.ts)
- `GET /`: Serve main setup page
- `GET /memories`: Serve memory management page
- `GET /:userId/memories`: Get all memories for a user
- `DELETE /:userId/memories/:memoryId`: Delete a memory
- `PUT /:userId/memories/:memoryId`: Update a memory
- `POST /:userId/memories/restore`: Restore missing memories to Vectorize

### MCP Protocol (src/mcp.ts)
- Implements the Model Context Protocol through Durable Objects
- Handles communication with AI clients like Cursor, Claude, and Windsurf
- Provides memory and artifact management tools

## Troubleshooting

### Common Issues
1. **Vectorize Connection**: Ensure Vectorize index is properly configured with correct dimensions and metric
2. **D1 Database**: Verify D1 database binding and permissions
3. **Workers AI**: Check that AI binding is correctly configured for embeddings
4. **CORS Issues**: Ensure proper CORS headers for cross-origin requests

### Debugging
- Use console.log statements for debugging (visible in Cloudflare dashboard)
- Check Cloudflare Workers logs for error messages
- Monitor Vectorize and D1 usage in Cloudflare dashboard

## Security

- Each user's memories are stored in isolated namespaces within Vectorize
- Built-in rate limiting prevents abuse
- Authentication is based on userId only (can be enhanced with additional layers)
- All data is stored in Cloudflare's secure infrastructure
- Communications are secured with TLS encryption

## Cost Information

The service is free for normal usage levels:
- Free tier allows 1,000 memories with ~28,000 queries per month
- Uses Cloudflare's free quota for Workers, Vectorize, Worker AI and D1 database
- Additional usage follows Cloudflare's standard pricing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run formatting: `npm run format`
5. Run linting: `npm run lint:fix`
6. Commit and push your changes
7. Create a pull request

When contributing, ensure:
- Code follows the established style conventions
- New features are documented
- Tests are added for new functionality (when test infrastructure exists)
- Changes are backward compatible when possible