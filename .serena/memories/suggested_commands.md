# MCP Context Library - Suggested Commands

## Development Commands

### Primary Development
```bash
# Start development server with Vectorize binding (preferred)
npm run dev

# Alternative development server
npm start

# Start development using wrangler directly
wrangler dev --experimental-vectorize-bind-to-prod
```

### Deployment
```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy using wrangler directly
wrangler deploy
```

### Code Quality
```bash
# Format code with Biome
npm run format

# Lint code with auto-fix
npm run lint:fix

# Generate TypeScript types from Wrangler config
npm run cf-typegen
```

### Setup Commands (One-time)
```bash
# Install dependencies
npm install

# Create Vectorize index (required for new deployments)
npx wrangler vectorize create vectorize-context-library --dimensions 1024 --metric cosine

# Login to Cloudflare (if not authenticated)
wrangler auth login
```

### Utility Commands
```bash
# Check Wrangler configuration
wrangler whoami

# View worker logs
wrangler tail

# View D1 database info
wrangler d1 info mcp-large-context

# View Vectorize index info
wrangler vectorize get vectorize-context-library
```

## System Commands (Darwin/macOS)

### File Operations
```bash
# List directory contents
ls -la

# Find files by pattern
find . -name "*.ts" -type f

# Search in files (using ripgrep if available)
rg "pattern" --type ts

# Search in files (using grep)
grep -r "pattern" src/
```

### Git Operations
```bash
# Check git status
git status

# View recent commits
git log --oneline -10

# Create feature branch
git checkout -b feature/description

# Stage and commit changes
git add .
git commit -m "feat: description"
```

### Process Management
```bash
# Find running processes
ps aux | grep node

# Kill process by PID
kill -9 <pid>

# Check port usage
lsof -i :8787
```

## Development Workflow
1. `npm run dev` - Start development server
2. Make code changes
3. `npm run format` - Format code
4. `npm run lint:fix` - Fix linting issues
5. Test locally via browser at `http://localhost:8787`
6. `npm run deploy` - Deploy when ready