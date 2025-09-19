# Testing & Validation Framework

## Testing Strategy Overview

Comprehensive testing approach covering unit tests, integration tests, security testing, and end-to-end validation for the GitHub OAuth implementation.

## Test Structure

```
tests/
├── unit/                 # Unit tests for individual functions
│   ├── auth/
│   ├── memory/
│   └── utils/
├── integration/          # Integration tests with real services
│   ├── oauth-flow/
│   ├── database/
│   └── api/
├── security/            # Security-focused tests
│   ├── authentication/
│   ├── rate-limiting/
│   └── csrf/
├── e2e/                 # End-to-end user scenarios
│   ├── user-journey/
│   └── mcp-integration/
├── fixtures/            # Test data and mocks
└── helpers/             # Testing utilities
```

## Unit Tests

### Authentication Service Tests

```typescript
// tests/unit/auth/token-generation.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateBearerToken, validateBearerToken } from '../../../src/utils/auth';
import { createTestDatabase } from '../../helpers/test-db';

describe('Token Generation', () => {
    let db: D1Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('should generate a valid bearer token', async () => {
        const userId = 'user_123';
        const token = await generateBearerToken(db, userId, 'Test Token');

        expect(token).toMatch(/^ctx_[A-Za-z0-9_-]+$/);
        expect(token.length).toBeGreaterThan(40);
    });

    it('should store hashed token in database', async () => {
        const userId = 'user_123';
        const token = await generateBearerToken(db, userId, 'Test Token');

        const stored = await db.prepare(
            'SELECT token_hash FROM auth_tokens WHERE user_id = ?'
        ).bind(userId).first();

        expect(stored).toBeDefined();
        expect(stored.token_hash).not.toBe(token);
        expect(stored.token_hash.length).toBe(64); // SHA-256 hex length
    });

    it('should set correct expiration date', async () => {
        const userId = 'user_123';
        const beforeGeneration = new Date();
        const token = await generateBearerToken(db, userId, 'Test Token');
        const afterGeneration = new Date();

        const stored = await db.prepare(
            'SELECT expires_at FROM auth_tokens WHERE user_id = ?'
        ).bind(userId).first();

        const expiresAt = new Date(stored.expires_at);
        const expectedExpiry = new Date(beforeGeneration.getTime() + 90 * 24 * 60 * 60 * 1000);

        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry.getTime() - 1000);
        expect(expiresAt.getTime()).toBeLessThanOrEqual(
            new Date(afterGeneration.getTime() + 90 * 24 * 60 * 60 * 1000).getTime() + 1000
        );
    });

    it('should reject invalid token formats', async () => {
        const invalidTokens = [
            'invalid_token',
            'ctx_',
            'ctx_123',
            'bearer_ctx_validtoken',
            ''
        ];

        for (const invalidToken of invalidTokens) {
            const result = await validateBearerToken(db, invalidToken);
            expect(result).toBeNull();
        }
    });

    it('should reject expired tokens', async () => {
        const userId = 'user_123';
        const token = await generateBearerToken(db, userId, 'Test Token');

        // Manually expire the token
        await db.prepare(
            'UPDATE auth_tokens SET expires_at = datetime("now", "-1 day") WHERE user_id = ?'
        ).bind(userId).run();

        const result = await validateBearerToken(db, token);
        expect(result).toBeNull();
    });
});
```

### OAuth Flow Tests

```typescript
// tests/unit/auth/oauth-flow.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CSRFProtection } from '../../../src/utils/csrf';

describe('OAuth Flow', () => {
    describe('CSRF Protection', () => {
        it('should generate valid state parameter', async () => {
            const state = await CSRFProtection.generateState();

            expect(state).toBeDefined();
            expect(typeof state).toBe('string');
            expect(state.length).toBeGreaterThan(20);
        });

        it('should validate fresh state parameter', async () => {
            const state = await CSRFProtection.generateState();
            const isValid = await CSRFProtection.validateState(state);

            expect(isValid).toBe(true);
        });

        it('should reject expired state parameter', async () => {
            const state = await CSRFProtection.generateState();

            // Mock old timestamp
            const oldState = btoa('old_state:' + (Date.now() - 700000).toString());
            const isValid = await CSRFProtection.validateState(oldState, 600000);

            expect(isValid).toBe(false);
        });

        it('should reject malformed state parameter', async () => {
            const malformedStates = [
                'invalid_base64',
                btoa('no_colon'),
                btoa('multiple:colons:here'),
                ''
            ];

            for (const state of malformedStates) {
                const isValid = await CSRFProtection.validateState(state);
                expect(isValid).toBe(false);
            }
        });
    });
});
```

## Integration Tests

### Database Migration Tests

```typescript
// tests/integration/database/migrations.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationRunner } from '../../../src/utils/migrations';
import { createTestDatabase } from '../../helpers/test-db';

describe('Database Migrations', () => {
    let db: D1Database;
    let migrationRunner: MigrationRunner;

    beforeEach(async () => {
        db = await createTestDatabase();
        migrationRunner = new MigrationRunner(db);
    });

    it('should create migration tracking table', async () => {
        await migrationRunner.runMigrations([]);

        const tables = await db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'
        `).first();

        expect(tables).toBeDefined();
    });

    it('should run migrations in order', async () => {
        const migrations = [
            {
                id: '001_create_users',
                description: 'Create users table',
                sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'
            },
            {
                id: '002_create_tokens',
                description: 'Create auth tokens table',
                sql: 'CREATE TABLE auth_tokens (id INTEGER PRIMARY KEY, user_id INTEGER);'
            }
        ];

        await migrationRunner.runMigrations(migrations);

        const executedMigrations = await db.prepare(
            'SELECT id FROM migrations ORDER BY executed_at'
        ).all();

        expect(executedMigrations.results).toHaveLength(2);
        expect(executedMigrations.results[0].id).toBe('001_create_users');
        expect(executedMigrations.results[1].id).toBe('002_create_tokens');
    });

    it('should skip already executed migrations', async () => {
        const migration = {
            id: '001_create_users',
            description: 'Create users table',
            sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'
        };

        // Run migration twice
        await migrationRunner.runMigrations([migration]);
        await migrationRunner.runMigrations([migration]);

        const executedMigrations = await db.prepare(
            'SELECT COUNT(*) as count FROM migrations WHERE id = ?'
        ).bind('001_create_users').first();

        expect(executedMigrations.count).toBe(1);
    });
});
```

### API Integration Tests

```typescript
// tests/integration/api/auth-endpoints.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app';
import { createTestUser } from '../../helpers/test-data';

describe('Authentication API', () => {
    let app: any;
    let testUser: any;

    beforeEach(async () => {
        app = await createTestApp();
        testUser = await createTestUser();
    });

    it('should initiate GitHub OAuth flow', async () => {
        const response = await app.request('/auth/github');

        expect(response.status).toBe(302);

        const location = response.headers.get('Location');
        expect(location).toContain('github.com/login/oauth/authorize');
        expect(location).toContain('client_id=');
        expect(location).toContain('state=');
    });

    it('should handle OAuth callback with valid code', async () => {
        // Mock GitHub API responses
        global.fetch = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ access_token: 'github_token' })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 12345,
                    login: 'testuser',
                    email: 'test@example.com'
                })
            });

        const response = await app.request('/auth/callback?code=github_code&state=valid_state');

        expect(response.status).toBe(302);

        const location = response.headers.get('Location');
        expect(location).toContain('/auth-success?token=ctx_');
    });

    it('should reject OAuth callback with invalid state', async () => {
        const response = await app.request('/auth/callback?code=github_code&state=invalid_state');

        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body.error).toContain('Invalid state parameter');
    });

    it('should generate bearer token for authenticated user', async () => {
        const response = await app.request('/auth/tokens', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${testUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Test Token' })
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.token).toMatch(/^ctx_[A-Za-z0-9_-]+$/);
        expect(body.name).toBe('Test Token');
        expect(body.expiresAt).toBeDefined();
    });

    it('should list user tokens', async () => {
        const response = await app.request('/auth/tokens', {
            headers: {
                'Authorization': `Bearer ${testUser.token}`
            }
        });

        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.tokens).toBeInstanceOf(Array);
        expect(body.tokens[0]).toHaveProperty('id');
        expect(body.tokens[0]).toHaveProperty('name');
        expect(body.tokens[0]).toHaveProperty('createdAt');
    });

    it('should revoke token', async () => {
        // Create a token to revoke
        const createResponse = await app.request('/auth/tokens', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${testUser.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Token to Revoke' })
        });

        const { id: tokenId } = await createResponse.json();

        // Revoke the token
        const revokeResponse = await app.request(`/auth/tokens/${tokenId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${testUser.token}`
            }
        });

        expect(revokeResponse.status).toBe(200);

        // Verify token is revoked
        const listResponse = await app.request('/auth/tokens', {
            headers: {
                'Authorization': `Bearer ${testUser.token}`
            }
        });

        const { tokens } = await listResponse.json();
        expect(tokens.find((t: any) => t.id === tokenId)).toBeUndefined();
    });
});
```

## Security Tests

### Rate Limiting Tests

```typescript
// tests/security/rate-limiting.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../helpers/test-app';
import { createTestUser } from '../../helpers/test-data';

describe('Rate Limiting', () => {
    let app: any;
    let testUser: any;

    beforeEach(async () => {
        app = await createTestApp();
        testUser = await createTestUser();
    });

    it('should allow requests within rate limit', async () => {
        const requests = Array.from({ length: 50 }, () =>
            app.request('/me/memories', {
                headers: { 'Authorization': `Bearer ${testUser.token}` }
            })
        );

        const responses = await Promise.all(requests);

        responses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
            expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
        });
    });

    it('should block requests exceeding rate limit', async () => {
        // Make 100 requests to hit the limit
        const hitLimitRequests = Array.from({ length: 100 }, () =>
            app.request('/me/memories', {
                headers: { 'Authorization': `Bearer ${testUser.token}` }
            })
        );

        await Promise.all(hitLimitRequests);

        // Next request should be rate limited
        const blockedResponse = await app.request('/me/memories', {
            headers: { 'Authorization': `Bearer ${testUser.token}` }
        });

        expect(blockedResponse.status).toBe(429);

        const body = await blockedResponse.json();
        expect(body.error).toContain('Rate limit exceeded');
        expect(body.limit).toBe(100);
        expect(body.reset).toBeDefined();
    });

    it('should reset rate limit after window expires', async () => {
        // This test would require mocking time or waiting for the window
        // Implementation depends on rate limiting strategy
    });
});
```

### Authentication Security Tests

```typescript
// tests/security/authentication.test.ts
import { describe, it, expect } from 'vitest';
import { createTestApp } from '../../helpers/test-app';

describe('Authentication Security', () => {
    let app: any;

    beforeEach(async () => {
        app = await createTestApp();
    });

    it('should reject requests without authorization header', async () => {
        const response = await app.request('/me/memories');

        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toContain('Missing or invalid authorization header');
    });

    it('should reject requests with invalid token format', async () => {
        const invalidTokens = [
            'Bearer invalid_token',
            'Bearer ctx_',
            'Bearer ctx_tooshort',
            'Basic ctx_validformat',
            'Bearer'
        ];

        for (const authHeader of invalidTokens) {
            const response = await app.request('/me/memories', {
                headers: { 'Authorization': authHeader }
            });

            expect(response.status).toBe(401);
        }
    });

    it('should reject requests with expired tokens', async () => {
        // Create and expire a token
        const expiredToken = 'ctx_expired_token_hash';

        const response = await app.request('/me/memories', {
            headers: { 'Authorization': `Bearer ${expiredToken}` }
        });

        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toContain('Invalid or expired token');
    });

    it('should update last_used_at timestamp on valid requests', async () => {
        // This would require a test user with a known token
        // and database verification of the timestamp update
    });
});
```

## End-to-End Tests

### Complete User Journey

```typescript
// tests/e2e/user-journey.test.ts
import { describe, it, expect } from 'vitest';
import { chromium, Page, Browser } from 'playwright';

describe('Complete User Journey', () => {
    let browser: Browser;
    let page: Page;

    beforeEach(async () => {
        browser = await chromium.launch();
        page = await browser.newPage();
    });

    afterEach(async () => {
        await browser.close();
    });

    it('should complete OAuth flow and generate token', async () => {
        // Navigate to dashboard
        await page.goto('http://localhost:3000');

        // Click login button
        await page.click('[data-testid="login-button"]');

        // Should redirect to GitHub OAuth
        await page.waitForURL('**/github.com/login/oauth/authorize**');

        // Mock GitHub login (in real test, use test GitHub account)
        // This would require setting up test GitHub OAuth app

        // After OAuth, should redirect back with token
        await page.waitForURL('**/auth-success?token=ctx_**');

        // Verify token is displayed
        const tokenElement = await page.locator('[data-testid="bearer-token"]');
        const token = await tokenElement.textContent();

        expect(token).toMatch(/^ctx_[A-Za-z0-9_-]+$/);
    });

    it('should use token to access MCP functionality', async () => {
        // This test would verify the complete flow from authentication
        // to MCP client usage
    });
});
```

### MCP Integration Tests

```typescript
// tests/e2e/mcp-integration.test.ts
import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('MCP Integration', () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeEach(async () => {
        // Set up MCP client connection
        transport = new StdioClientTransport({
            command: 'node',
            args: ['dist/mcp-server.js'],
            env: {
                ...process.env,
                BEARER_TOKEN: 'ctx_test_token'
            }
        });

        client = new Client(
            { name: 'test-client', version: '1.0.0' },
            { capabilities: {} }
        );

        await client.connect(transport);
    });

    afterEach(async () => {
        await client.close();
    });

    it('should initialize MCP server with authentication', async () => {
        const serverInfo = await client.initialize();

        expect(serverInfo.name).toBe('MCP Context Library');
        expect(serverInfo.version).toBeDefined();
    });

    it('should list available tools', async () => {
        const tools = await client.listTools();

        expect(tools.tools).toContainEqual(
            expect.objectContaining({
                name: 'add_to_memory',
                description: expect.stringContaining('stores important user information')
            })
        );

        expect(tools.tools).toContainEqual(
            expect.objectContaining({
                name: 'search_memory',
                description: expect.stringContaining('searches the user\'s persistent memory')
            })
        );
    });

    it('should add memory with authentication', async () => {
        const result = await client.callTool({
            name: 'add_to_memory',
            arguments: {
                thingToRemember: 'User prefers TypeScript for new projects',
                title: 'TypeScript Preference',
                documentType: 'Memory',
                tags: ['typescript', 'preferences']
            }
        });

        expect(result.content).toContainEqual(
            expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('Memory stored successfully')
            })
        );
    });

    it('should search memories with authentication', async () => {
        // First add a memory
        await client.callTool({
            name: 'add_to_memory',
            arguments: {
                thingToRemember: 'User prefers React for frontend development',
                documentType: 'Memory'
            }
        });

        // Then search for it
        const result = await client.callTool({
            name: 'search_memory',
            arguments: {
                informationToGet: 'What frontend framework does the user prefer?'
            }
        });

        expect(result.content).toContainEqual(
            expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('React')
            })
        );
    });
});
```

## Test Helpers and Utilities

### Test Database Setup

```typescript
// tests/helpers/test-db.ts
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export async function createTestDatabase(): Promise<D1Database> {
    const dbPath = `:memory:${randomUUID()}`;
    const db = new Database(dbPath);

    // Create tables
    db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            github_id TEXT UNIQUE NOT NULL,
            github_username TEXT NOT NULL,
            email TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE auth_tokens (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL DEFAULT 'Default Token',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL,
            last_used_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
        );

        CREATE TABLE memories (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            document_type TEXT DEFAULT 'Memory',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    `);

    // Wrap better-sqlite3 to match D1 interface
    return {
        prepare: (query: string) => {
            const stmt = db.prepare(query);
            return {
                bind: (...params: any[]) => ({
                    first: () => stmt.get(...params),
                    all: () => ({ results: stmt.all(...params) }),
                    run: () => ({ changes: stmt.run(...params).changes })
                }),
                first: () => stmt.get(),
                all: () => ({ results: stmt.all() }),
                run: () => ({ changes: stmt.run().changes })
            };
        },
        exec: (query: string) => db.exec(query),
        batch: (statements: any[]) => {
            const transaction = db.transaction(() => {
                for (const stmt of statements) {
                    stmt.run();
                }
            });
            return transaction();
        }
    } as any;
}
```

### Test Data Factory

```typescript
// tests/helpers/test-data.ts
import { generateBearerToken } from '../../src/utils/auth';

export async function createTestUser(db?: D1Database, overrides?: any) {
    const defaultUser = {
        githubId: '12345',
        username: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        ...overrides
    };

    if (db) {
        await db.prepare(`
            INSERT INTO users (github_id, github_username, email, name)
            VALUES (?, ?, ?, ?)
        `).bind(defaultUser.githubId, defaultUser.username, defaultUser.email, defaultUser.name).run();

        const user = await db.prepare(
            'SELECT id FROM users WHERE github_id = ?'
        ).bind(defaultUser.githubId).first();

        const token = await generateBearerToken(db, user.id, 'Test Token');

        return {
            ...defaultUser,
            id: user.id,
            token
        };
    }

    return defaultUser;
}

export function createTestMemory(overrides?: any) {
    return {
        content: 'Test memory content',
        documentType: 'Memory',
        projectName: 'test-project',
        tags: ['test'],
        metadata: { source: 'test' },
        ...overrides
    };
}
```

## Running Tests

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for specific file
npm test -- auth

# Run tests with verbose output
npm test -- --verbose
```

### Test Configuration

```json
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        'coverage/'
      ]
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000
  }
});
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          GITHUB_CLIENT_ID: ${{ secrets.TEST_GITHUB_CLIENT_ID }}
          GITHUB_CLIENT_SECRET: ${{ secrets.TEST_GITHUB_CLIENT_SECRET }}

      - name: Run security tests
        run: npm run test:security

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```