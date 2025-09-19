# Development & Deployment Guide

## Project Setup

### Prerequisites

- Node.js 18+ with npm
- Cloudflare account with Workers enabled
- GitHub account for OAuth app registration
- Git for version control

### Environment Configuration

```bash
# Clone repository
git clone https://github.com/your-org/context-library-11.git
cd context-library-11

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Required Environment Variables

```bash
# .env.local
GITHUB_CLIENT_ID=your_github_app_client_id
GITHUB_CLIENT_SECRET=your_github_app_client_secret
GITHUB_CALLBACK_URL=http://localhost:8787/auth/callback

# Development
NODE_ENV=development
LOG_LEVEL=debug

# Cloudflare (for production)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Application
MCP_NAME="Context-Library MCP (Development)"
DASHBOARD_URL=http://localhost:3000
JWT_SECRET=your_256_bit_development_secret
```

## Development Workflow

### Local Development

```bash
# Start Cloudflare Workers development server
npm run dev

# Alternative dev command
npm start

# The server will be available at http://localhost:8787
```

### Development with Dashboard

```bash
# Terminal 1: Start Workers development server
npm run dev

# Terminal 2: Start dashboard development server (in dashboard directory)
cd dashboard
npm run dev
# Dashboard available at http://localhost:3000
```

### Code Quality

```bash
# Run formatter (Biome)
npm run format

# Run linter with auto-fix
npm run lint:fix

# Generate TypeScript types from Wrangler config
npm run cf-typegen
```

## Database Operations

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate

# Create new migration
npm run migration:create "migration_name"

# Rollback last migration (if rollback SQL provided)
npm run migration:rollback
```

### Database Management

```bash
# Access D1 database console
npx wrangler d1 execute mcp-large-context --command "SELECT * FROM users LIMIT 10"

# Import data from SQL file
npx wrangler d1 execute mcp-large-context --file ./migrations/seed_data.sql

# Export database backup
npx wrangler d1 export mcp-large-context --output backup.sql
```

### Local Database Setup

```bash
# Create local D1 database for development
npx wrangler d1 create mcp-large-context-dev

# Apply migrations to local database
npx wrangler d1 migrations apply mcp-large-context-dev --local

# Seed development data
npx wrangler d1 execute mcp-large-context-dev --file ./scripts/seed.sql --local
```

## GitHub OAuth Setup

### Create GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Configure:
   - **Application name**: Context-Library MCP
   - **Homepage URL**: `http://localhost:8787` (dev) or `https://context-library.dev` (prod)
   - **Authorization callback URL**: `http://localhost:8787/auth/callback` (dev)
4. Save the Client ID and Client Secret

### Update Environment Variables

```bash
# Add to .env.local
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

## Testing Strategy

### Unit Tests

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run integration tests against local database
npm run test:integration

# Run tests against development environment
npm run test:e2e:dev
```

### API Testing

```bash
# Test authentication flow
curl -X GET http://localhost:8787/auth/github

# Test protected endpoint (with valid token)
curl -H "Authorization: Bearer ctx_your_token" \
     http://localhost:8787/me/memories

# Test rate limiting
for i in {1..110}; do
  curl -H "Authorization: Bearer ctx_your_token" \
       http://localhost:8787/me/memories &
done
```

## Code Standards

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "lib": ["ES2021"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "types": ["@cloudflare/workers-types"]
  }
}
```

### Code Style (Biome)

```json
{
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 4,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "performance": {
        "noAccumulatingSpread": "error"
      }
    }
  }
}
```

### Naming Conventions

```typescript
// Files: kebab-case
auth-middleware.ts
user-service.ts

// Functions and variables: camelCase
const getUserMemories = async () => {};
const bearerToken = generateToken();

// Classes: PascalCase
class AuthenticationService {}
class MigrationRunner {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRIES = 3;
const DEFAULT_RATE_LIMIT = 100;

// Types/Interfaces: PascalCase
interface UserContext {
    id: string;
    username: string;
}

type TokenResponse = {
    token: string;
    expiresAt: string;
};
```

## Deployment

### Production Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deploy with specific environment
npm run deploy:staging
npm run deploy:production
```

### Pre-deployment Checklist

```bash
# 1. Run all tests
npm test
npm run test:integration

# 2. Check code quality
npm run lint:fix
npm run format

# 3. Generate fresh types
npm run cf-typegen

# 4. Verify environment variables
npm run env:verify

# 5. Run database migrations
npm run migrate

# 6. Deploy
npm run deploy
```

### Environment-specific Deployments

```bash
# wrangler.toml
[env.staging]
name = "context-library-staging"
vars = { MCP_NAME = "Context-Library MCP (Staging)" }

[env.production]
name = "context-library-production"
vars = { MCP_NAME = "Context-Library MCP" }

# Deploy to specific environment
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

## Monitoring & Debugging

### Development Logging

```typescript
// Enhanced logging for development
class Logger {
    static debug(message: string, data?: any): void {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
        }
    }

    static info(message: string, data?: any): void {
        console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : '');
    }

    static error(message: string, error?: any): void {
        console.error(`[ERROR] ${message}`, error?.stack || error);
    }
}
```

### Performance Monitoring

```bash
# Monitor Workers performance
npx wrangler tail --format pretty

# Monitor specific functions
npx wrangler tail --grep "auth"

# View real-time logs
npx wrangler tail --filter "console.log"
```

### Production Monitoring

```typescript
// Analytics and monitoring
async function trackMetrics(env: Env, event: string, data: any): Promise<void> {
    // Cloudflare Analytics
    await env.ANALYTICS.writeDataPoint({
        blobs: [event, JSON.stringify(data)],
        doubles: [Date.now()],
        indexes: [data.userId || 'anonymous']
    });
}

// Usage in endpoints
app.post('/me/memories', async (c) => {
    const memory = await createMemory(/* ... */);

    await trackMetrics(c.env, 'memory_created', {
        userId: c.get('user').id,
        documentType: memory.documentType,
        contentLength: memory.content.length
    });

    return c.json(memory);
});
```

## Troubleshooting

### Common Issues

**1. OAuth Callback Errors**
```bash
# Check GitHub app configuration
curl -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/apps/your-app-name

# Verify callback URL matches exactly
echo $GITHUB_CALLBACK_URL
```

**2. Database Connection Issues**
```bash
# Test D1 connection
npx wrangler d1 execute mcp-large-context --command "SELECT 1"

# Check database exists
npx wrangler d1 list
```

**3. Token Validation Failures**
```typescript
// Debug token validation
async function debugTokenValidation(token: string): Promise<void> {
    console.log('Token format:', token.startsWith('ctx_'));
    const hash = await sha256(token);
    console.log('Token hash:', hash);

    const result = await db.prepare(
        'SELECT * FROM auth_tokens WHERE token_hash = ?'
    ).bind(hash).first();
    console.log('Database result:', result);
}
```

**4. Rate Limiting Issues**
```bash
# Check current rate limits
curl -I -H "Authorization: Bearer ctx_your_token" \
     http://localhost:8787/me/memories

# Look for X-RateLimit-* headers
```

### Development Tools

**Database Browser**
```bash
# Install sqlite3 locally for database inspection
npm install -g sqlite3

# Browse local D1 database
sqlite3 .wrangler/state/d1/DB.sqlite3
.tables
.schema users
SELECT * FROM users LIMIT 5;
```

**API Testing with Postman**
```json
{
  "info": {
    "name": "Context-Library API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{bearer_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:8787"
    },
    {
      "key": "bearer_token",
      "value": "ctx_your_token_here"
    }
  ]
}
```

## Performance Optimization

### Database Query Optimization

```typescript
// Use prepared statements with proper indexing
const getUserMemoriesOptimized = db.prepare(`
    SELECT id, content, document_type, created_at
    FROM memories
    WHERE user_id = ? AND created_at > ?
    ORDER BY created_at DESC
    LIMIT ?
`);

// Batch operations for better performance
async function bulkCreateMemories(memories: Memory[]): Promise<void> {
    const statements = memories.map(memory =>
        db.prepare(`
            INSERT INTO memories (user_id, content, metadata, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(memory.userId, memory.content, JSON.stringify(memory.metadata), memory.createdAt)
    );

    await db.batch(statements);
}
```

### Caching Strategy

```typescript
// Cache frequently accessed data
const cache = new Map<string, { data: any; expires: number }>();

async function getCachedUserProfile(userId: string): Promise<any> {
    const key = `user_profile_${userId}`;
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }

    const profile = await getUserProfile(userId);
    cache.set(key, {
        data: profile,
        expires: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    return profile;
}
```

## Security Checklist

### Pre-deployment Security Review

- [ ] All secrets properly configured in Cloudflare Workers
- [ ] Rate limiting enabled and tested
- [ ] CSRF protection implemented for OAuth flow
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] Token expiration and rotation working
- [ ] User data isolation verified
- [ ] Sensitive data not logged
- [ ] HTTPS enforced in production

### Security Testing

```bash
# Test SQL injection prevention
curl -X POST http://localhost:8787/me/memories \
     -H "Authorization: Bearer ctx_token" \
     -H "Content-Type: application/json" \
     -d '{"content": "test\"; DROP TABLE users; --"}'

# Test rate limiting
for i in {1..110}; do
  curl -H "Authorization: Bearer ctx_token" \
       http://localhost:8787/me/memories &
done

# Test CSRF protection
curl -X GET http://localhost:8787/auth/github \
     -H "Origin: https://malicious-site.com"
```